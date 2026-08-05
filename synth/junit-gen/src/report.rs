//! Building JUnit reports. Rendering is pure — it draws no randomness of its own.
//!
//! Reports are laid out to *end* at `finished_at`, because the uploader warns both
//! on reports older than an hour and on cases stamped in the future.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use quick_junit::{
    NonSuccessKind, NonSuccessReruns, Report, TestCase, TestCaseStatus, TestRerun, TestSuite,
};

use crate::identity::TestIdentity;
use crate::seed::StoryRng;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Pass,
    Fail,
    Skip,
    PassAfterRetries { failures: usize },
}

impl Outcome {
    pub fn is_failure(&self) -> bool {
        matches!(self, Self::Fail)
    }
}

#[derive(Debug, Clone)]
pub struct TestCaseSpec {
    pub identity: TestIdentity,
    pub outcome: Outcome,
    pub duration: Duration,
    pub retry_duration: Option<Duration>,
    pub message: Option<String>,
}

impl TestCaseSpec {
    pub fn new(identity: TestIdentity, outcome: Outcome, duration: Duration) -> Self {
        Self {
            identity,
            outcome,
            duration,
            retry_duration: None,
            message: None,
        }
    }

    pub fn with_retry_duration(mut self, duration: Duration) -> Self {
        self.retry_duration = Some(duration);
        self
    }

    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    fn failure_duration(&self) -> Duration {
        self.retry_duration.unwrap_or(self.duration)
    }
}

#[derive(Debug, Clone)]
pub struct SuiteSpec {
    pub name: String,
    pub cases: Vec<TestCaseSpec>,
}

#[derive(Debug, Clone)]
pub struct ReportSpec {
    pub name: String,
    pub finished_at: DateTime<Utc>,
    pub cases: Vec<TestCaseSpec>,
}

impl ReportSpec {
    pub fn new(name: impl Into<String>, finished_at: DateTime<Utc>) -> Self {
        Self {
            name: name.into(),
            finished_at,
            cases: Vec::new(),
        }
    }

    pub fn push(&mut self, case: TestCaseSpec) {
        self.cases.push(case);
    }

    pub fn extend(&mut self, cases: impl IntoIterator<Item = TestCaseSpec>) {
        self.cases.extend(cases);
    }

    pub fn is_empty(&self) -> bool {
        self.cases.is_empty()
    }

    pub fn suites(&self) -> Vec<SuiteSpec> {
        let mut suites: Vec<SuiteSpec> = Vec::new();
        for case in &self.cases {
            match suites.iter_mut().find(|s| s.name == case.identity.suite) {
                Some(suite) => suite.cases.push(case.clone()),
                None => suites.push(SuiteSpec {
                    name: case.identity.suite.clone(),
                    cases: vec![case.clone()],
                }),
            }
        }
        suites
    }
}

pub fn render(spec: &ReportSpec) -> Report {
    let started_at = spec.finished_at - total_duration(spec);

    let mut report = Report::new(spec.name.clone());
    report.set_timestamp(started_at.fixed_offset());

    let mut elapsed = Duration::ZERO;
    let mut suites = Vec::new();

    for suite_spec in spec.suites() {
        let suite_started = elapsed;
        let mut suite = TestSuite::new(suite_spec.name.clone());
        suite.set_timestamp((started_at + suite_started).fixed_offset());

        for case_spec in &suite_spec.cases {
            let case_started_at = started_at + elapsed;
            let (status, consumed) = render_status(case_spec, case_started_at);

            let mut case = TestCase::new(case_spec.identity.name.clone(), status);
            case.set_classname(case_spec.identity.classname.clone());
            case.set_timestamp(case_started_at.fixed_offset());
            case.set_time(match case_spec.outcome {
                Outcome::Skip => Duration::ZERO,
                _ => case_spec.duration,
            });
            case.extra
                .insert("file".into(), case_spec.identity.file.clone().into());

            elapsed += consumed;
            suite.add_test_case(case);
        }

        suite.set_time(elapsed - suite_started);
        suites.push(suite);
    }

    report.add_test_suites(suites);
    report.set_time(elapsed);
    report
}

fn total_duration(spec: &ReportSpec) -> Duration {
    spec.cases.iter().map(consumed_by).sum()
}

fn consumed_by(spec: &TestCaseSpec) -> Duration {
    match spec.outcome {
        Outcome::Skip => Duration::ZERO,
        Outcome::Pass | Outcome::Fail => spec.duration,
        Outcome::PassAfterRetries { failures } => {
            spec.failure_duration() * u32::try_from(failures).unwrap_or(u32::MAX) + spec.duration
        }
    }
}

fn render_status(spec: &TestCaseSpec, started_at: DateTime<Utc>) -> (TestCaseStatus, Duration) {
    match spec.outcome {
        Outcome::Pass => (
            TestCaseStatus::Success {
                flaky_runs: Vec::new(),
            },
            spec.duration,
        ),
        Outcome::Skip => (TestCaseStatus::skipped(), Duration::ZERO),
        Outcome::Fail => (
            TestCaseStatus::NonSuccess {
                kind: NonSuccessKind::Failure,
                message: Some(spec.message.clone().unwrap_or_else(default_message).into()),
                ty: Some("AssertionError".into()),
                description: None,
                reruns: NonSuccessReruns::default(),
            },
            spec.duration,
        ),
        Outcome::PassAfterRetries { failures } => {
            let mut reruns = Vec::with_capacity(failures);
            let mut elapsed = Duration::ZERO;

            for attempt in 0..failures {
                let mut rerun = TestRerun::new(NonSuccessKind::Failure);
                rerun.set_timestamp((started_at + elapsed).fixed_offset());
                rerun.set_time(spec.failure_duration());
                rerun.set_message(format!(
                    "{} (attempt {})",
                    spec.message.clone().unwrap_or_else(default_message),
                    attempt + 1
                ));
                reruns.push(rerun);
                elapsed += spec.failure_duration();
            }

            (
                TestCaseStatus::Success { flaky_runs: reruns },
                elapsed + spec.duration,
            )
        }
    }
}

fn default_message() -> String {
    "synthetic failure: this test exists to trip a monitor".to_owned()
}

pub fn write_report(dir: impl AsRef<Path>, file_name: &str, report: &Report) -> Result<PathBuf> {
    let dir = dir.as_ref();
    fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;

    let path = dir.join(file_name);
    let file = fs::File::create(&path).with_context(|| format!("creating {}", path.display()))?;
    report
        .serialize(file)
        .with_context(|| format!("serializing {}", path.display()))?;
    Ok(path)
}

#[derive(Debug, Clone, Copy)]
pub struct Durations {
    pub pass_ms: (u64, u64),
    pub fail_ms: (u64, u64),
}

impl Default for Durations {
    fn default() -> Self {
        Self {
            pass_ms: (120, 2_400),
            fail_ms: (150, 3_000),
        }
    }
}

impl Durations {
    pub fn draw(&self, rng: &mut StoryRng, outcome: Outcome) -> Duration {
        let (low, high) = if outcome.is_failure() {
            self.fail_ms
        } else {
            self.pass_ms
        };
        Duration::from_millis(rng.in_range(low, high))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::DateBucket;
    use chrono::NaiveDate;

    fn at() -> DateTime<Utc> {
        NaiveDate::from_ymd_opt(2026, 8, 4)
            .and_then(|d| d.and_hms_opt(12, 0, 0))
            .expect("valid datetime")
            .and_utc()
    }

    fn spec_with(outcomes: &[(&str, &str, Outcome)]) -> ReportSpec {
        let mut spec = ReportSpec::new("synth", at());
        for (suite, name, outcome) in outcomes {
            spec.push(TestCaseSpec::new(
                TestIdentity::in_suite("demo", suite, name),
                *outcome,
                Duration::from_millis(500),
            ));
        }
        spec
    }

    #[test]
    fn cases_group_into_suites_in_first_seen_order() {
        let spec = spec_with(&[
            ("Beta", "one", Outcome::Pass),
            ("Alpha", "two", Outcome::Pass),
            ("Beta", "three", Outcome::Pass),
        ]);

        let suites = spec.suites();
        assert_eq!(suites.len(), 2);
        assert_eq!(suites[0].name, "Beta");
        assert_eq!(suites[0].cases.len(), 2);
        assert_eq!(suites[1].name, "Alpha");
    }

    #[test]
    fn rendering_is_deterministic() {
        let spec = spec_with(&[
            ("Alpha", "one", Outcome::Pass),
            ("Alpha", "two", Outcome::Fail),
        ]);
        let first = render(&spec).to_string().expect("serializes");
        let second = render(&spec).to_string().expect("serializes");
        assert_eq!(first, second);
    }

    #[test]
    fn identity_fields_reach_the_xml_unchanged() {
        let spec = spec_with(&[("CheckoutFlow", "applies_promo_code", Outcome::Pass)]);
        let xml = render(&spec).to_string().expect("serializes");

        assert!(xml.contains(r#"name="applies_promo_code""#), "{xml}");
        assert!(
            xml.contains(r#"classname="synth.demo.CheckoutFlow""#),
            "{xml}"
        );
        assert!(
            xml.contains(r#"file="synth/demo/checkout_flow.ts""#),
            "{xml}"
        );
        assert!(xml.contains(r#"<testsuite name="CheckoutFlow""#), "{xml}");
    }

    #[test]
    fn a_failure_renders_as_a_failure_not_an_error() {
        let spec = spec_with(&[("Alpha", "one", Outcome::Fail)]);
        let xml = render(&spec).to_string().expect("serializes");
        assert!(xml.contains("<failure"), "{xml}");
        assert!(!xml.contains("<error"), "{xml}");
    }

    #[test]
    fn a_skip_renders_as_skipped_with_no_duration() {
        let spec = spec_with(&[("Alpha", "one", Outcome::Skip)]);
        let report = render(&spec);
        let xml = report.to_string().expect("serializes");

        assert!(xml.contains("<skipped"), "{xml}");
        assert_eq!(
            report.test_suites[0].test_cases[0].time,
            Some(Duration::ZERO)
        );
        assert_eq!(report.time, Some(Duration::ZERO));
    }

    #[test]
    fn pass_after_retries_emits_one_rerun_per_failed_attempt() {
        let spec = spec_with(&[("Alpha", "one", Outcome::PassAfterRetries { failures: 2 })]);
        let xml = render(&spec).to_string().expect("serializes");

        assert_eq!(xml.matches("<flakyFailure").count(), 2, "{xml}");
        assert!(xml.contains("attempt 1"), "{xml}");
        assert!(xml.contains("attempt 2"), "{xml}");
    }

    #[test]
    fn retry_duration_pins_failed_attempts_independently_of_the_pass() {
        let mut spec = ReportSpec::new("synth", at());
        spec.push(
            TestCaseSpec::new(
                TestIdentity::in_suite("demo", "Alpha", "one"),
                Outcome::PassAfterRetries { failures: 1 },
                Duration::from_millis(200),
            )
            .with_retry_duration(Duration::from_secs(30)),
        );

        let xml = render(&spec).to_string().expect("serializes");
        assert!(xml.contains(r#"<flakyFailure timestamp="#), "{xml}");
        assert!(xml.contains(r#"time="30.000""#), "{xml}");
        assert!(xml.contains(r#"time="0.200""#), "{xml}");
    }

    #[test]
    fn the_run_is_laid_out_to_end_at_finished_at() {
        let mut spec = ReportSpec::new("synth", at());
        for name in ["one", "two", "three"] {
            spec.push(TestCaseSpec::new(
                TestIdentity::in_suite("demo", "Alpha", name),
                Outcome::Pass,
                Duration::from_secs(5),
            ));
        }

        let report = render(&spec);
        let started = report.timestamp.expect("report is timestamped");
        assert_eq!(started, (at() - Duration::from_secs(15)).fixed_offset());

        let suite = &report.test_suites[0];
        let last = suite.test_cases.last().expect("has cases");
        let last_started = last.timestamp.expect("case is timestamped");
        let last_ended = last_started + last.time.expect("case is timed");
        assert_eq!(last_ended, at().fixed_offset());
    }

    #[test]
    fn retried_attempts_count_toward_the_layout() {
        let mut spec = ReportSpec::new("synth", at());
        spec.push(
            TestCaseSpec::new(
                TestIdentity::in_suite("demo", "Alpha", "one"),
                Outcome::PassAfterRetries { failures: 2 },
                Duration::from_secs(1),
            )
            .with_retry_duration(Duration::from_secs(10)),
        );

        let report = render(&spec);
        assert_eq!(report.time, Some(Duration::from_secs(21)));
        assert_eq!(
            report.timestamp.expect("timestamped"),
            (at() - Duration::from_secs(21)).fixed_offset()
        );
    }

    #[test]
    fn report_time_is_the_sum_of_what_ran() {
        let mut spec = ReportSpec::new("synth", at());
        for name in ["one", "two"] {
            spec.push(TestCaseSpec::new(
                TestIdentity::in_suite("demo", "Alpha", name),
                Outcome::Pass,
                Duration::from_secs(2),
            ));
        }
        let report = render(&spec);
        assert_eq!(report.time, Some(Duration::from_secs(4)));
    }

    #[test]
    fn drawn_durations_are_reproducible_and_in_range() {
        let durations = Durations::default();
        let bucket = DateBucket::Day(NaiveDate::from_ymd_opt(2026, 8, 4).expect("valid date"));

        let mut a = StoryRng::derive("demo", bucket);
        let mut b = StoryRng::derive("demo", bucket);
        for _ in 0..32 {
            let drawn = durations.draw(&mut a, Outcome::Pass);
            assert_eq!(drawn, durations.draw(&mut b, Outcome::Pass));
            assert!(drawn >= Duration::from_millis(120));
            assert!(drawn <= Duration::from_millis(2_400));
        }
    }
}

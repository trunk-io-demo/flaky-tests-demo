//! Choosing what each case reports. Pure: a seeded RNG, no clock, no filesystem,
//! and identity never drawn from the RNG. Durable names come from the test's
//! index so partitioning decides the shape and the count decides the size; churn
//! names are word-random because they are meant to be thrown away.

use chrono::{DateTime, Utc};
use harness::report::TestCaseSpec;
use harness::{churn, duration, DateBucket, Outcome, StoryRng, TestIdentity};
use synth_config::Params;

pub const STORY_ID: &str = "fabricated";
pub const CHURN_SUITE_PREFIX: &str = "Churn";
pub const HEALTHCHECK_SUITE: &str = "Healthcheck";
/// The healthcheck has no natural class, but identity has the slot, so it gets one.
pub const HEALTHCHECK_CLASS: &str = "Class00";
pub const HEALTHCHECK_NAME: &str = "generator_is_reporting";

/// So `classname` says where a test sits rather than renaming its suite.
pub const TESTS_PER_CLASS: u32 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Slot {
    pub index: u32,
    pub durable: bool,
    pub tests_per_suite: u32,
}

impl Slot {
    pub fn suite_index(&self) -> u32 {
        self.index / self.tests_per_suite
    }

    pub fn index_in_suite(&self) -> u32 {
        self.index % self.tests_per_suite
    }

    pub fn class_index(&self) -> u32 {
        self.index_in_suite() / TESTS_PER_CLASS
    }

    pub fn suite(&self) -> String {
        let prefix = if self.durable {
            "Suite"
        } else {
            CHURN_SUITE_PREFIX
        };
        format!("{prefix}{:02}", self.suite_index())
    }

    pub fn class(&self) -> String {
        format!("Class{:02}", self.class_index())
    }

    /// A durable test's name. Churn tests bring their own.
    pub fn durable_name(&self) -> String {
        format!("test_{:02}", self.index_in_suite())
    }

    pub fn identity(&self, name: &str) -> TestIdentity {
        TestIdentity::in_class(STORY_ID, &self.suite(), &self.class(), name)
    }
}

pub fn healthcheck(params: &Params, now: DateTime<Utc>) -> TestCaseSpec {
    let mut rng = StoryRng::derive_with(STORY_ID, DateBucket::hour_of(now), HEALTHCHECK_NAME);
    TestCaseSpec::new(
        TestIdentity::in_class(
            STORY_ID,
            HEALTHCHECK_SUITE,
            HEALTHCHECK_CLASS,
            HEALTHCHECK_NAME,
        ),
        Outcome::Pass,
        duration::draw(&mut rng, &params.pass_duration),
    )
}

/// Churn names are seeded from the day, so the churn population turns over daily:
/// yesterday's names stop reporting and today's are new. A fixed seed would mean
/// churn never actually churns.
fn population(params: &Params, now: DateTime<Utc>) -> Vec<(Slot, String)> {
    let tests_per_suite = params.tests_per_suite.get();
    let mut naming = StoryRng::derive_with(STORY_ID, DateBucket::day_of(now), "names");
    let mut population = Vec::with_capacity(params.total_tests() as usize);

    for index in 0..params.durable_test_count.get() {
        let slot = Slot {
            index,
            durable: true,
            tests_per_suite,
        };
        population.push((slot, slot.durable_name()));
    }
    for index in 0..params.churn_test_count.get() {
        let slot = Slot {
            index,
            durable: false,
            tests_per_suite,
        };
        population.push((slot, churn::name(&mut naming)));
    }
    population
}

pub fn suites(params: &Params, now: DateTime<Utc>, run: u32) -> Vec<Vec<TestCaseSpec>> {
    let mut suites: Vec<Vec<TestCaseSpec>> = Vec::new();
    let mut current: Vec<TestCaseSpec> = Vec::new();
    let mut current_suite: Option<String> = None;

    for (slot, name) in &population(params, now) {
        let suite = slot.suite();
        if current_suite.as_deref() != Some(suite.as_str()) {
            if !current.is_empty() {
                suites.push(std::mem::take(&mut current));
            }
            current_suite = Some(suite);
        }
        current.push(case(params, now, slot, name, run));
    }
    if !current.is_empty() {
        suites.push(current);
    }
    suites
}

/// Suites packed `suites_per_report` at a time: splits one population across more
/// uploads without touching identity. Never spans two runs — a JUnit report
/// describes one run, and mixing them would repeat a suite in one file.
pub fn reports(params: &Params, now: DateTime<Utc>) -> Vec<Vec<TestCaseSpec>> {
    let per_report = params.suites_per_report.get() as usize;
    (0..params.runs_per_test.get())
        .flat_map(|run| {
            suites(params, now, run)
                .chunks(per_report)
                .map(<[Vec<TestCaseSpec>]>::concat)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn case(params: &Params, now: DateTime<Utc>, slot: &Slot, name: &str, run: u32) -> TestCaseSpec {
    let mut rng = StoryRng::derive_with(
        STORY_ID,
        DateBucket::hour_of(now),
        &format!("{}#{}#{name}#{run}", slot.suite(), slot.class()),
    );
    let outcome = draw_outcome(params, &mut rng, slot.index_in_suite());
    let identity = slot.identity(name);

    let mut spec = match outcome {
        Outcome::PassAfterRetries { .. } => TestCaseSpec::new(
            identity,
            outcome,
            duration::draw(&mut rng, &params.pass_duration),
        )
        .with_retry_duration(duration::draw(&mut rng, &params.timeout_ceiling_duration)),
        Outcome::Fail => TestCaseSpec::new(
            identity,
            outcome,
            duration::draw(&mut rng, &params.fail_duration),
        ),
        _ => TestCaseSpec::new(
            identity,
            outcome,
            duration::draw(&mut rng, &params.pass_duration),
        ),
    };

    if outcome == Outcome::Fail {
        spec = spec.with_message(format!(
            "synthetic failure: this test fails at {}% so that a monitor has something to detect",
            params.effective_failure_rate(slot.index_in_suite())
        ));
    }
    spec
}

fn draw_outcome(params: &Params, rng: &mut StoryRng, index_in_suite: u32) -> Outcome {
    if rng.chance(params.effective_failure_rate(index_in_suite).get()) {
        Outcome::Fail
    } else if rng.chance(params.skip_rate.get()) {
        Outcome::Skip
    } else if rng.chance(params.flake_rate.get()) {
        Outcome::PassAfterRetries {
            failures: params.flake_retry_count.get() as usize,
        }
    } else {
        Outcome::Pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use std::collections::BTreeSet;

    fn at() -> DateTime<Utc> {
        NaiveDate::from_ymd_opt(2026, 8, 5)
            .and_then(|day| day.and_hms_opt(4, 0, 0))
            .expect("valid datetime")
            .and_utc()
    }

    fn params(pairs: &[(&str, &str)]) -> Params {
        let lookup = |key: &str| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        };
        Params::resolve(&lookup).params
    }

    fn cases(params: &Params) -> Vec<TestCaseSpec> {
        reports(params, at()).concat()
    }

    #[test]
    fn a_name_is_derived_from_where_the_test_sits() {
        let slot = Slot {
            index: 13,
            durable: true,
            tests_per_suite: 8,
        };
        assert_eq!(slot.suite_index(), 1);
        assert_eq!(slot.index_in_suite(), 5);
        assert_eq!(slot.class_index(), 1);
        assert_eq!(slot.suite(), "Suite01");
        assert_eq!(slot.class(), "Class01");
        assert_eq!(
            slot.identity("test_05").classname,
            "synth.fabricated.Suite01.Class01"
        );
    }

    #[test]
    fn a_class_turns_over_every_five_tests_in_a_suite() {
        let classes: Vec<u32> = (0..8)
            .map(|index| {
                Slot {
                    index,
                    durable: true,
                    tests_per_suite: 8,
                }
                .class_index()
            })
            .collect();
        assert_eq!(classes, vec![0, 0, 0, 0, 0, 1, 1, 1]);
    }

    #[test]
    fn the_defaults_emit_one_case_per_test() {
        let params = params(&[]);
        assert_eq!(cases(&params).len() as u32, params.total_tests());
    }

    fn durable_identities(count: u32, tests_per_suite: u32) -> BTreeSet<TestIdentity> {
        (0..count)
            .map(|index| {
                let slot = Slot {
                    index,
                    durable: true,
                    tests_per_suite,
                };
                slot.identity(&slot.durable_name())
            })
            .collect()
    }

    /// Identity is `index / tests_per_suite` and `index % tests_per_suite`, so a new
    /// one appears if *either* dimension grows: more suites, or wider suites.
    #[test]
    fn nothing_new_appears_unless_a_dimension_grows() {
        for (old, new, expect_new) in [
            ((48, 8), (24, 4), false), // 6 suites -> 6, narrower: retires the tail
            ((48, 8), (30, 5), false), // 6 suites -> 6, narrower
            ((48, 8), (60, 10), true), // 6 suites -> 6 but wider: adds test_08, test_09
            ((48, 8), (48, 4), true),  // 6 suites -> 12
            ((48, 8), (32, 4), true),  // 6 suites -> 8
            ((48, 8), (96, 8), true),  // 6 suites -> 12, appended
        ] {
            let before = durable_identities(old.0, old.1);
            let after = durable_identities(new.0, new.1);
            let minted: Vec<&TestIdentity> = after.difference(&before).collect();

            assert_eq!(
                !minted.is_empty(),
                expect_new,
                "{old:?} -> {new:?} minted {} identities",
                minted.len()
            );
        }
    }

    #[test]
    fn narrowing_the_suites_alone_re_identifies_half_the_population() {
        let before = durable_identities(48, 8);
        let after = durable_identities(48, 4);

        assert_eq!(before.intersection(&after).count(), 24, "kept");
        assert_eq!(before.difference(&after).count(), 24, "orphaned");
        assert_eq!(after.difference(&before).count(), 24, "new");
    }

    #[test]
    fn a_bigger_count_adds_tests_without_moving_the_existing_ones() {
        let small = cases(&params(&[
            ("SYNTH_DURABLE_TEST_COUNT", "48"),
            ("SYNTH_CHURN_TEST_COUNT", "0"),
        ]));
        let large = cases(&params(&[
            ("SYNTH_DURABLE_TEST_COUNT", "96"),
            ("SYNTH_CHURN_TEST_COUNT", "0"),
        ]));

        assert_eq!(large.len(), 96);
        for (a, b) in small.iter().zip(large.iter()) {
            assert_eq!(a.identity, b.identity, "an existing test moved");
        }
    }

    #[test]
    fn more_suites_than_fit_spill_into_further_reports() {
        let params = params(&[
            ("SYNTH_DURABLE_TEST_COUNT", "100"),
            ("SYNTH_CHURN_TEST_COUNT", "0"),
        ]);
        assert_eq!(params.suite_count(), 13);
        assert_eq!(params.report_count(), 3);

        let reports = reports(&params, at());
        assert_eq!(reports.len(), 3);
        assert_eq!(
            reports.iter().map(Vec::len).sum::<usize>(),
            100,
            "batching loses and duplicates nothing"
        );
    }

    #[test]
    fn the_suite_count_is_what_gets_built() {
        for pairs in [
            vec![],
            vec![
                ("SYNTH_DURABLE_TEST_COUNT", "50"),
                ("SYNTH_CHURN_TEST_COUNT", "10"),
            ],
            vec![
                ("SYNTH_DURABLE_TEST_COUNT", "3"),
                ("SYNTH_CHURN_TEST_COUNT", "3"),
            ],
            vec![("SYNTH_CHURN_TEST_COUNT", "0")],
        ] {
            let params = params(&pairs);
            assert_eq!(
                suites(&params, at(), 0).len() as u32,
                params.suite_count(),
                "{pairs:?}"
            );
        }
    }

    #[test]
    fn the_report_count_is_what_gets_written() {
        for pairs in [
            vec![],
            vec![("SYNTH_DURABLE_TEST_COUNT", "100")],
            vec![("SYNTH_RUNS_PER_TEST", "3")],
            vec![
                ("SYNTH_DURABLE_TEST_COUNT", "100"),
                ("SYNTH_RUNS_PER_TEST", "3"),
            ],
            vec![
                ("SYNTH_CHURN_TEST_COUNT", "37"),
                ("SYNTH_RUNS_PER_TEST", "2"),
            ],
        ] {
            let params = params(&pairs);
            let written = reports(&params, at());
            assert_eq!(
                written.len() as u32,
                params.report_count(),
                "{pairs:?} predicted {} reports and wrote {}",
                params.report_count(),
                written.len()
            );
            assert_eq!(
                written.iter().map(Vec::len).sum::<usize>() as u32,
                params.total_cases(),
                "{pairs:?} lost or duplicated cases"
            );
        }
    }

    #[test]
    fn no_report_mixes_two_runs_of_the_same_suite() {
        let params = params(&[("SYNTH_RUNS_PER_TEST", "3")]);
        for report in reports(&params, at()) {
            let mut seen = std::collections::BTreeMap::new();
            for case in &report {
                *seen
                    .entry((case.identity.classname.clone(), case.identity.name.clone()))
                    .or_insert(0) += 1;
            }
            assert!(
                seen.values().all(|count| *count == 1),
                "a report contains the same test twice"
            );
        }
    }

    #[test]
    fn runs_per_test_repeats_identity_rather_than_inventing_tests() {
        let params = params(&[
            ("SYNTH_RUNS_PER_TEST", "3"),
            ("SYNTH_CHURN_TEST_COUNT", "0"),
        ]);
        let cases = cases(&params);

        assert_eq!(cases.len(), 144);
        let distinct: std::collections::BTreeSet<String> = cases
            .iter()
            .map(|case| format!("{}::{}", case.identity.classname, case.identity.name))
            .collect();
        assert_eq!(distinct.len(), 48, "runs must not create new identities");
    }

    #[test]
    fn churn_tests_land_in_their_own_suites_with_word_random_names() {
        let params = params(&[("SYNTH_CHURN_TEST_COUNT", "20")]);
        let cases = cases(&params);

        assert_eq!(cases.len() as u32, params.total_tests());
        let churn: Vec<&TestCaseSpec> = cases
            .iter()
            .filter(|case| case.identity.suite.starts_with(CHURN_SUITE_PREFIX))
            .collect();
        assert_eq!(churn.len(), 20);
        assert!(churn
            .iter()
            .all(|case| !case.identity.name.starts_with("test_")));
    }

    #[test]
    fn churn_names_turn_over_daily_and_durable_names_do_not() {
        let params = params(&[("SYNTH_CHURN_TEST_COUNT", "20")]);
        let tomorrow = at() + chrono::Duration::days(1);

        let names = |instant| -> (BTreeSet<String>, BTreeSet<String>) {
            let cases = reports(&params, instant).concat();
            let split = |churn: bool| {
                cases
                    .iter()
                    .filter(|case| case.identity.suite.starts_with(CHURN_SUITE_PREFIX) == churn)
                    .map(|case| case.identity.name.clone())
                    .collect()
            };
            (split(false), split(true))
        };

        let (durable_today, churn_today) = names(at());
        let (durable_tomorrow, churn_tomorrow) = names(tomorrow);

        assert_eq!(
            durable_today, durable_tomorrow,
            "durable names must not move with the calendar"
        );
        assert!(
            churn_today.is_disjoint(&churn_tomorrow),
            "every churn name should retire and be replaced overnight"
        );
    }

    #[test]
    fn an_hour_later_is_the_same_tests_with_different_outcomes() {
        let params = params(&[("SYNTH_CHURN_TEST_COUNT", "0")]);
        let now = reports(&params, at()).concat();
        let later = reports(&params, at() + chrono::Duration::hours(1)).concat();

        let ids = |cases: &[TestCaseSpec]| -> Vec<TestIdentity> {
            cases.iter().map(|case| case.identity.clone()).collect()
        };
        assert_eq!(ids(&now), ids(&later), "identity must not move hourly");
        assert_ne!(
            now.iter().map(|c| c.outcome).collect::<Vec<_>>(),
            later.iter().map(|c| c.outcome).collect::<Vec<_>>(),
            "outcomes are seeded per hour, so they should differ"
        );
    }

    #[test]
    fn the_same_bucket_produces_byte_identical_plans() {
        let params = params(&[("SYNTH_CHURN_TEST_COUNT", "16")]);
        for (a, b) in cases(&params).iter().zip(cases(&params).iter()) {
            assert_eq!(a.identity, b.identity);
            assert_eq!(a.outcome, b.outcome);
            assert_eq!(a.duration, b.duration);
        }
    }

    #[test]
    fn a_hundred_percent_failure_rate_fails_every_case() {
        let cases = cases(&params(&[("SYNTH_FAILURE_RATE", "100")]));
        assert!(!cases.is_empty());
        assert!(
            cases.iter().all(|case| case.outcome == Outcome::Fail),
            "an infrastructure-failure upload must not contain a pass or a skip"
        );
    }

    #[test]
    fn the_observed_failure_rate_matches_the_configured_one() {
        let params = params(&[("SYNTH_RUNS_PER_TEST", "60")]);
        let cases = cases(&params);

        let failures = cases
            .iter()
            .filter(|case| case.outcome == Outcome::Fail)
            .count();
        let observed = failures * 100 / cases.len();
        assert!(
            (8..=17).contains(&observed),
            "a 12% setting produced {observed}% over {} cases",
            cases.len()
        );
    }

    #[test]
    fn a_flake_retries_on_a_timeout_and_then_passes_quickly() {
        let params = params(&[("SYNTH_FLAKE_RATE", "100"), ("SYNTH_FAILURE_RATE", "0")]);
        let flakes: Vec<TestCaseSpec> = cases(&params)
            .into_iter()
            .filter(|case| matches!(case.outcome, Outcome::PassAfterRetries { .. }))
            .collect();

        assert!(!flakes.is_empty());
        for flake in flakes {
            let retry = flake.retry_duration.expect("a flake has a retry duration");
            assert!(
                retry > flake.duration,
                "a timeout-then-pass flake waits longer than it passes"
            );
        }
    }

    #[test]
    fn the_healthcheck_is_one_passing_case_of_its_own() {
        let case = healthcheck(&params(&[("SYNTH_FAILURE_RATE", "100")]), at());
        assert_eq!(case.outcome, Outcome::Pass);
        assert_eq!(case.identity.suite, HEALTHCHECK_SUITE);
    }
}

//! What the run is, in one struct. [`parameters`] holds every parameter with its
//! range beside its value and is the file to read; [`clamp`] is the machinery.

pub mod clamp;
pub mod parameters;

pub use clamp::{Clampable, Notice, Var};
pub use parameters::{
    ChurnTestCount, Distribution, DurableTestCount, DurationSpreadMs, FailureRate, FlakeRate,
    MedianDurationMs, RelativeRateSpread, RetriesPerFlake, RunsPerTest, SkipRate, SuitesPerReport,
    TestsPerSuite,
};

use serde::Serialize;

use parameters::{
    CHURN_TEST_COUNT, DURABLE_TEST_COUNT, FAILURE_RATE, FAIL_DURATION, FLAKE_RATE,
    FLAKE_RETRY_COUNT, PASS_DURATION, RATE_SPREAD, RUNS_PER_TEST, SKIP_RATE, SUITES_PER_REPORT,
    TESTS_PER_SUITE, TIMEOUT_CEILING_DURATION,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Params {
    pub failure_rate: FailureRate,
    pub flake_rate: FlakeRate,
    pub skip_rate: SkipRate,
    pub runs_per_test: RunsPerTest,
    pub durable_test_count: DurableTestCount,
    pub churn_test_count: ChurnTestCount,
    pub tests_per_suite: TestsPerSuite,
    pub suites_per_report: SuitesPerReport,
    pub rate_spread: RelativeRateSpread,
    pub flake_retry_count: RetriesPerFlake,
    pub pass_duration: Distribution,
    pub fail_duration: Distribution,
    pub timeout_ceiling_duration: Distribution,
}

#[derive(Debug, Clone)]
pub struct Loaded {
    pub params: Params,
    pub notices: Vec<Notice>,
}

impl Params {
    pub fn load() -> Loaded {
        Self::resolve(&|key| std::env::var(key).ok())
    }

    /// Takes its environment rather than reading it, so tests never race on it.
    pub fn resolve(lookup: &dyn Fn(&str) -> Option<String>) -> Loaded {
        let mut notices = Vec::new();

        let failure_rate = FAILURE_RATE.read(lookup(FAILURE_RATE.name).as_deref(), &mut notices);
        let flake_rate = FLAKE_RATE.read(lookup(FLAKE_RATE.name).as_deref(), &mut notices);
        let runs_per_test = RUNS_PER_TEST.read(lookup(RUNS_PER_TEST.name).as_deref(), &mut notices);
        let durable_test_count =
            DURABLE_TEST_COUNT.read(lookup(DURABLE_TEST_COUNT.name).as_deref(), &mut notices);
        let churn_test_count =
            CHURN_TEST_COUNT.read(lookup(CHURN_TEST_COUNT.name).as_deref(), &mut notices);

        let params = Self {
            failure_rate,
            flake_rate: room_left_by(failure_rate, flake_rate),
            skip_rate: room_left_by(failure_rate, SKIP_RATE),
            runs_per_test,
            durable_test_count,
            churn_test_count,
            tests_per_suite: TESTS_PER_SUITE,
            suites_per_report: SUITES_PER_REPORT,
            rate_spread: RATE_SPREAD,
            flake_retry_count: FLAKE_RETRY_COUNT,
            pass_duration: PASS_DURATION,
            fail_duration: FAIL_DURATION,
            timeout_ceiling_duration: TIMEOUT_CEILING_DURATION,
        };

        let distinct = params.distinct_suite_rates();
        if !params.has_flat_rates() && distinct < params.tests_per_suite.get() as usize {
            notices.push(Notice::NarrowRateSpread {
                failure_rate: params.failure_rate.get(),
                tests_per_suite: params.tests_per_suite.get(),
                distinct,
            });
        }

        Loaded { params, notices }
    }

    pub fn total_tests(&self) -> u32 {
        self.durable_test_count
            .get()
            .saturating_add(self.churn_test_count.get())
    }

    pub fn total_cases(&self) -> u32 {
        self.total_tests().saturating_mul(self.runs_per_test.get())
    }

    /// Each population is indexed from zero, so each rounds up to a whole suite of
    /// its own: a partial durable suite is never topped up with churn tests.
    pub fn suite_count(&self) -> u32 {
        let per_suite = self.tests_per_suite.get();
        let durable = self.durable_test_count.get().div_ceil(per_suite);
        let churn = self.churn_test_count.get().div_ceil(per_suite);
        durable.saturating_add(churn)
    }

    /// Per-run packing times the run count: a report never spans two runs.
    pub fn report_count(&self) -> u32 {
        self.suite_count()
            .div_ceil(self.suites_per_report.get())
            .saturating_mul(self.runs_per_test.get())
    }

    /// Spread across a suite so no two tests fail alike, within the room skips leave.
    pub fn effective_failure_rate(&self, index_in_suite: u32) -> FailureRate {
        if self.has_flat_rates() {
            return self.failure_rate;
        }

        let tests = self.tests_per_suite.get();
        let configured = u32::from(self.failure_rate.get());
        let spread = u32::from(self.rate_spread.get());
        let ceiling = 100 - u32::from(self.skip_rate.get());

        let high = (configured * (100 + spread) / 100).min(ceiling);
        let low = (configured * (100 - spread) / 100).min(high);
        let index = index_in_suite % tests;

        let value = low + (high - low) * index / (tests - 1);
        FailureRate::saturating_from(u8::try_from(value).unwrap_or(u8::MAX))
    }

    pub fn suite_failure_rates(&self) -> Vec<u8> {
        (0..self.tests_per_suite.get())
            .map(|index| self.effective_failure_rate(index).get())
            .collect()
    }

    /// Nothing to spread at either extreme: at 0% none fail, at 100% all do.
    pub fn has_flat_rates(&self) -> bool {
        let rate = self.failure_rate.get();
        rate == FailureRate::MIN_VALUE
            || rate == FailureRate::MAX_VALUE
            || self.tests_per_suite.get() <= 1
    }

    pub fn distinct_suite_rates(&self) -> usize {
        let mut rates = self.suite_failure_rates();
        rates.sort_unstable();
        rates.dedup();
        rates.len()
    }
}

/// One three-way split, so a skip or flake takes only the room failures leave.
fn room_left_by<B: Clampable<Primitive = u8>>(failure_rate: FailureRate, other: B) -> B {
    B::saturating_from(other.raw().min(FailureRate::MAX_VALUE - failure_rate.get()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |key| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        }
    }

    fn resolve(pairs: &[(&str, &str)]) -> Loaded {
        Params::resolve(&env(pairs))
    }

    fn defaults() -> Params {
        resolve(&[]).params
    }

    fn with_failure_rate(value: u8) -> Loaded {
        resolve(&[("SYNTH_FAILURE_RATE", &value.to_string())])
    }

    #[test]
    fn the_defaults_are_valid_and_quiet() {
        let loaded = resolve(&[]);
        assert!(loaded.notices.is_empty(), "{:?}", loaded.notices);
        assert_eq!(
            loaded.params.failure_rate.get(),
            FAILURE_RATE.default_value().get()
        );
        assert_eq!(
            loaded.params.flake_rate.get(),
            FLAKE_RATE.default_value().get()
        );
        assert_eq!(loaded.params.skip_rate.get(), SKIP_RATE.get());
        assert_eq!(
            loaded.params.runs_per_test.get(),
            RUNS_PER_TEST.default_value().get()
        );
        assert_eq!(
            loaded.params.churn_test_count.get(),
            CHURN_TEST_COUNT.default_value().get()
        );
        assert!(!loaded.params.has_flat_rates());
    }

    #[test]
    fn the_two_populations_are_separate_totals() {
        let params = resolve(&[
            ("SYNTH_DURABLE_TEST_COUNT", "40"),
            ("SYNTH_CHURN_TEST_COUNT", "60"),
        ])
        .params;

        assert_eq!(params.durable_test_count.get(), 40);
        assert_eq!(params.churn_test_count.get(), 60);
        assert_eq!(params.total_tests(), 100);
    }

    #[test]
    fn the_partitioning_follows_the_counts_rather_than_setting_them() {
        let params = resolve(&[
            ("SYNTH_DURABLE_TEST_COUNT", "100"),
            ("SYNTH_CHURN_TEST_COUNT", "0"),
        ])
        .params;

        assert_eq!(params.tests_per_suite.get(), 8);
        assert_eq!(params.suite_count(), 13, "100 tests, 8 to a suite");
        assert_eq!(params.report_count(), 3, "13 suites, 6 to a report");
    }

    #[test]
    fn every_test_in_a_suite_gets_its_own_rate() {
        let rates = defaults().suite_failure_rates();
        assert_eq!(rates, vec![7, 8, 9, 10, 12, 13, 14, 16]);
        assert_eq!(defaults().distinct_suite_rates(), rates.len());
    }

    #[test]
    fn the_four_repo_variables_are_the_only_ones_read() {
        let loaded = resolve(&[
            ("SYNTH_FAILURE_RATE", "30"),
            ("SYNTH_FLAKE_RATE", "20"),
            ("SYNTH_RUNS_PER_TEST", "4"),
            ("SYNTH_CHURN_TEST_COUNT", "120"),
        ]);

        assert_eq!(loaded.params.failure_rate.get(), 30);
        assert_eq!(loaded.params.flake_rate.get(), 20);
        assert_eq!(loaded.params.runs_per_test.get(), 4);
        assert_eq!(loaded.params.churn_test_count.get(), 120);
        assert_eq!(loaded.params.total_cases(), (48 + 120) * 4);
    }

    #[test]
    fn a_repo_variable_out_of_range_clamps_rather_than_failing_the_run() {
        let loaded = resolve(&[("SYNTH_RUNS_PER_TEST", "9000")]);
        assert_eq!(loaded.params.runs_per_test.get(), 100);
        assert_eq!(loaded.notices.len(), 1);
        assert!(loaded.notices[0].to_string().contains("clamped to 100"));
    }

    #[test]
    fn nothing_survives_a_hundred_percent_failure_rate_to_dilute_it() {
        let loaded = resolve(&[("SYNTH_FAILURE_RATE", "100"), ("SYNTH_FLAKE_RATE", "40")]);
        let params = &loaded.params;

        assert_eq!(params.flake_rate.get(), 0);
        assert_eq!(params.skip_rate.get(), 0);
        assert!(params.has_flat_rates());
        assert_eq!(params.suite_failure_rates(), vec![100; 8]);
    }

    #[test]
    fn skips_and_flakes_take_only_the_room_failures_leave() {
        for failure in [12u8, 98, 99, 100] {
            let params = with_failure_rate(failure).params;
            let room = 100 - failure;

            assert_eq!(
                params.skip_rate.get(),
                SKIP_RATE.get().min(room),
                "skip at {failure}%"
            );
            assert_eq!(
                params.flake_rate.get(),
                FLAKE_RATE.default_value().get().min(room),
                "flake at {failure}%"
            );
        }
    }

    #[test]
    fn only_the_two_extremes_go_flat() {
        for rate in [0u8, 100] {
            assert!(
                with_failure_rate(rate).params.has_flat_rates(),
                "{rate}% should be flat"
            );
        }
        for rate in [1u8, 50, 99] {
            assert!(
                !with_failure_rate(rate).params.has_flat_rates(),
                "{rate}% should spread"
            );
        }
    }

    #[test]
    fn the_spread_never_eats_the_room_a_skip_rate_needs() {
        for failure_rate in 0..=100u8 {
            for skip_rate in [0u8, 3, 25, 60, 100] {
                let mut params = defaults();
                params.failure_rate = FailureRate::new(failure_rate).expect("a rate");
                params.skip_rate = room_left_by(
                    params.failure_rate,
                    SkipRate::new(skip_rate).expect("a rate"),
                );

                let highest = params
                    .suite_failure_rates()
                    .into_iter()
                    .max()
                    .expect("a suite has tests");
                assert!(
                    u32::from(highest) + u32::from(params.skip_rate.get()) <= 100,
                    "{failure_rate}% failure and {skip_rate}% skip produced {highest}%"
                );
            }
        }
    }

    #[test]
    fn a_high_rate_still_gives_every_test_in_a_suite_its_own() {
        let loaded = with_failure_rate(79);
        assert_eq!(
            loaded.params.suite_failure_rates(),
            vec![47, 54, 61, 68, 75, 82, 89, 97]
        );
        assert_eq!(loaded.params.distinct_suite_rates(), 8);
        assert!(loaded.notices.is_empty(), "{:?}", loaded.notices);
    }

    #[test]
    fn a_spread_too_narrow_to_separate_its_tests_reports_rather_than_refusing() {
        let loaded = with_failure_rate(3);
        assert!(loaded.params.distinct_suite_rates() < 8);
        assert!(
            loaded
                .notices
                .iter()
                .any(|notice| notice.to_string().contains("spreads too narrowly")),
            "{:?}",
            loaded.notices
        );
    }
}

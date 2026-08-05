//! What a run does, at a glance: every parameter, the range it is held to, and
//! its value. Five repository variables carry volume and rates; a constant is
//! anything that would change what a story *means*.

use bounded_integer::bounded_integer;
use serde::Serialize;

use crate::clamp::Var;

bounded_integer! {
    #[repr(u8)] pub struct FailureRate(0, 100);
}
bounded_integer! {
    #[repr(u8)] pub struct SkipRate(0, 100);
}
bounded_integer! {
    #[repr(u8)] pub struct FlakeRate(0, 100);
}
bounded_integer! {
    /// How far each test's failure rate deviates from the configured one, as a
    /// percentage **of that rate**: 40 spreads a suite across `rate x 0.6 .. 1.4`.
    #[repr(u8)] pub struct RelativeRateSpread(0, 90);
}
bounded_integer! {
    #[repr(u32)] pub struct TestsPerSuite(1, 50);
}
bounded_integer! {
    #[repr(u32)] pub struct SuitesPerReport(1, 20);
}
bounded_integer! {
    #[repr(u32)] pub struct DurableTestCount(1, 20_000);
}
bounded_integer! {
    #[repr(u32)] pub struct ChurnTestCount(0, 40_000);
}
bounded_integer! {
    #[repr(u32)] pub struct RunsPerTest(1, 100);
}
bounded_integer! {
    #[repr(u32)] pub struct RetriesPerFlake(1, 10);
}
bounded_integer! {
    #[repr(u64)] pub struct MedianDurationMs(1, 600_000);
}
bounded_integer! {
    #[repr(u64)] pub struct DurationSpreadMs(0, 120_000);
}

/// A constant of a bounded type: out of range it does not compile.
macro_rules! fixed {
    ($bounded:ty, $value:expr) => {
        match <$bounded>::new($value) {
            Some(value) => value,
            None => unreachable!(),
        }
    };
}

/// How often a test fails. Applies to both populations.
pub const FAILURE_RATE: Var<FailureRate> = Var::new("SYNTH_FAILURE_RATE", fixed!(FailureRate, 12));

/// How often a test fails then passes on a retry. Applies to both populations.
pub const FLAKE_RATE: Var<FlakeRate> = Var::new("SYNTH_FLAKE_RATE", fixed!(FlakeRate, 5));

/// Times every test reports per upload, under one identity. Thickens history for
/// both populations without adding tests to either.
pub const RUNS_PER_TEST: Var<RunsPerTest> = Var::new("SYNTH_RUNS_PER_TEST", fixed!(RunsPerTest, 1));

/// Size of the durable population. Raising it appends tests and leaves the
/// existing ones' identity alone; lowering it retires the tail.
pub const DURABLE_TEST_COUNT: Var<DurableTestCount> =
    Var::new("SYNTH_DURABLE_TEST_COUNT", fixed!(DurableTestCount, 48));

/// Size of the churn population, which is disposable and word-random. Kept small
/// by default, because churn dilutes the durable set's new-test signal.
pub const CHURN_TEST_COUNT: Var<ChurnTestCount> =
    Var::new("SYNTH_CHURN_TEST_COUNT", fixed!(ChurnTestCount, 10));

/// How often a test reports as skipped, in both populations.
pub const SKIP_RATE: SkipRate = fixed!(SkipRate, 3);

/// Spreads the failure rate across a suite so no two tests in one fail alike.
/// Indexed by position, so it applies to both populations identically.
pub const RATE_SPREAD: RelativeRateSpread = fixed!(RelativeRateSpread, 40);

/// Tests per suite. Partitions both populations, and because the suite is part of
/// `classname`, changing it re-identifies every durable test.
pub const TESTS_PER_SUITE: TestsPerSuite = fixed!(TestsPerSuite, 8);

/// Suites per report file. Pure packaging — it splits the same tests across more
/// uploads to stress ingestion, and touches no identity in either population.
pub const SUITES_PER_REPORT: SuitesPerReport = fixed!(SuitesPerReport, 6);

/// Failed attempts before a flaky test passes, in both populations.
pub const FLAKE_RETRY_COUNT: RetriesPerFlake = fixed!(RetriesPerFlake, 2);

/// Duration of a passing case, and of a flake's final attempt.
pub const PASS_DURATION: Distribution = Distribution::new(
    "pass duration",
    fixed!(MedianDurationMs, 1_000),
    fixed!(DurationSpreadMs, 300),
);

/// Duration of a failing case. Slower than a pass on purpose.
pub const FAIL_DURATION: Distribution = Distribution::new(
    "fail duration",
    fixed!(MedianDurationMs, 3_000),
    fixed!(DurationSpreadMs, 1_000),
);

/// Duration of a flake's failed attempts: a tight cluster at a timeout, so the
/// two halves of one pair look nothing alike.
pub const TIMEOUT_CEILING_DURATION: Distribution = Distribution::new(
    "timeout ceiling",
    fixed!(MedianDurationMs, 5_000),
    fixed!(DurationSpreadMs, 150),
);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Distribution {
    pub name: &'static str,
    pub median: MedianDurationMs,
    pub spread: DurationSpreadMs,
}

impl Distribution {
    pub const fn new(
        name: &'static str,
        median: MedianDurationMs,
        spread: DurationSpreadMs,
    ) -> Self {
        Self {
            name,
            median,
            spread,
        }
    }

    pub fn median_ms(&self) -> u64 {
        self.median.get()
    }

    pub fn spread_ms(&self) -> u64 {
        self.spread.get()
    }

    pub fn low_ms(&self) -> u64 {
        self.median_ms()
            .saturating_sub(3 * self.spread_ms())
            .max(MedianDurationMs::MIN_VALUE)
    }

    pub fn high_ms(&self) -> u64 {
        self.median_ms().saturating_add(3 * self.spread_ms())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn distribution(median: u64, spread: u64) -> Distribution {
        Distribution::new(
            "test",
            MedianDurationMs::new(median).expect("in range"),
            DurationSpreadMs::new(spread).expect("in range"),
        )
    }

    #[test]
    fn three_sigma_bounds_never_reach_zero() {
        let wide = distribution(100, 500);
        assert_eq!(wide.low_ms(), 1);
        assert_eq!(wide.high_ms(), 1_600);
    }

    #[test]
    fn a_tight_spread_keeps_both_bounds_near_the_median() {
        let ceiling = distribution(5_000, 150);
        assert_eq!(ceiling.low_ms(), 4_550);
        assert_eq!(ceiling.high_ms(), 5_450);
    }
}

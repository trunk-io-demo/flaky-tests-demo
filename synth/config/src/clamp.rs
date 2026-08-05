//! Clamping a repository variable into a bounded value, and reporting when it had
//! to be adjusted. Nothing here knows what any particular parameter means.

use std::fmt;
use std::str::FromStr;

use crate::parameters::{
    ChurnTestCount, DurableTestCount, DurationSpreadMs, FailureRate, FlakeRate, MedianDurationMs,
    RelativeRateSpread, RetriesPerFlake, RunsPerTest, SkipRate, SuitesPerReport, TestsPerSuite,
};

pub trait Clampable: Copy + fmt::Display {
    type Primitive: Copy + fmt::Display + PartialEq + FromStr;

    const LOW: Self::Primitive;
    const HIGH: Self::Primitive;

    fn saturating_from(value: Self::Primitive) -> Self;
    fn raw(self) -> Self::Primitive;
}

macro_rules! clampable {
    ($($bounded:ty => $primitive:ty),* $(,)?) => {$(
        impl Clampable for $bounded {
            type Primitive = $primitive;

            const LOW: $primitive = <$bounded>::MIN_VALUE;
            const HIGH: $primitive = <$bounded>::MAX_VALUE;

            fn saturating_from(value: $primitive) -> Self {
                Self::new_saturating(value)
            }

            fn raw(self) -> $primitive {
                self.get()
            }
        }
    )*};
}

clampable! {
    DurableTestCount => u32,
    FailureRate => u8,
    SkipRate => u8,
    FlakeRate => u8,
    RelativeRateSpread => u8,
    TestsPerSuite => u32,
    SuitesPerReport => u32,
    ChurnTestCount => u32,
    RunsPerTest => u32,
    RetriesPerFlake => u32,
    MedianDurationMs => u64,
    DurationSpreadMs => u64,
}

#[derive(Debug, Clone, Copy)]
pub struct Var<B> {
    pub name: &'static str,
    default: B,
}

impl<B> Var<B> {
    pub const fn new(name: &'static str, default: B) -> Self {
        Self { name, default }
    }
}

impl<B: Clampable> Var<B> {
    pub fn default_value(&self) -> B {
        self.default
    }

    /// Takes the raw value rather than reading the environment, so a test can
    /// exercise every branch without mutating process state.
    pub fn read(&self, raw: Option<&str>, notices: &mut Vec<Notice>) -> B {
        let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
            return self.default;
        };

        match raw.parse::<B::Primitive>() {
            Ok(parsed) => {
                let used = B::saturating_from(parsed);
                if used.raw() != parsed {
                    notices.push(Notice::Clampable {
                        var: self.name,
                        requested: parsed.to_string(),
                        used: used.to_string(),
                        low: B::LOW.to_string(),
                        high: B::HIGH.to_string(),
                    });
                }
                used
            }
            Err(_) => {
                notices.push(Notice::Unreadable {
                    var: self.name,
                    raw: raw.to_owned(),
                    used: self.default.to_string(),
                });
                self.default
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Notice {
    Clampable {
        var: &'static str,
        requested: String,
        used: String,
        low: String,
        high: String,
    },
    Unreadable {
        var: &'static str,
        raw: String,
        used: String,
    },
    NarrowRateSpread {
        failure_rate: u8,
        tests_per_suite: u32,
        distinct: usize,
    },
}

impl fmt::Display for Notice {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Clampable {
                var,
                requested,
                used,
                low,
                high,
            } => write!(
                f,
                "{var} was {requested}, outside {low}..={high}; clamped to {used}"
            ),
            Self::Unreadable { var, raw, used } => {
                write!(f, "{var} was {raw:?}, which does not parse; using {used}")
            }
            Self::NarrowRateSpread {
                failure_rate,
                tests_per_suite,
                distinct,
            } => write!(
                f,
                "a {failure_rate}% failure rate spreads too narrowly to give {tests_per_suite} \
                 tests their own rate: only {distinct} are distinct"
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parameters::{FailureRate, RunsPerTest};

    const RATE: Var<FailureRate> = Var::new("SYNTH_TEST_RATE", FailureRate::new(12).unwrap());

    fn read(raw: Option<&str>) -> (u8, Vec<Notice>) {
        let mut notices = Vec::new();
        let value = RATE.read(raw, &mut notices);
        (value.get(), notices)
    }

    #[test]
    fn an_absent_or_blank_value_is_the_default_and_says_nothing() {
        for raw in [None, Some(""), Some("   ")] {
            let (value, notices) = read(raw);
            assert_eq!(value, 12);
            assert!(notices.is_empty(), "{raw:?} produced {notices:?}");
        }
    }

    #[test]
    fn a_value_in_range_is_taken_verbatim() {
        let (value, notices) = read(Some(" 40 "));
        assert_eq!(value, 40);
        assert!(notices.is_empty());
    }

    #[test]
    fn a_value_over_the_range_clamps_and_reports() {
        let (value, notices) = read(Some("240"));
        assert_eq!(value, 100);
        assert_eq!(notices.len(), 1);
        assert!(notices[0].to_string().contains("clamped to 100"));
    }

    #[test]
    fn a_value_under_the_range_clamps_to_the_floor() {
        const RUNS: Var<RunsPerTest> = Var::new("SYNTH_TEST_RUNS", RunsPerTest::new(1).unwrap());
        let mut notices = Vec::new();
        assert_eq!(RUNS.read(Some("0"), &mut notices).get(), 1);
        assert!(notices[0].to_string().contains("outside 1..=100"));
    }

    #[test]
    fn an_unparseable_value_falls_back_and_reports() {
        let (value, notices) = read(Some("twelve"));
        assert_eq!(value, 12);
        assert_eq!(notices.len(), 1);
        assert!(notices[0].to_string().contains("does not parse"));
    }

    #[test]
    fn a_negative_value_reads_as_unparseable_not_as_a_floor() {
        let (value, notices) = read(Some("-5"));
        assert_eq!(value, 12);
        assert!(notices[0].to_string().contains("does not parse"));
    }

    #[test]
    fn the_bounds_travel_with_the_type() {
        assert_eq!((FailureRate::MIN_VALUE, FailureRate::MAX_VALUE), (0, 100));
        assert_eq!(
            (RelativeRateSpread::MIN_VALUE, RelativeRateSpread::MAX_VALUE),
            (0, 90)
        );
        assert_eq!(
            (MedianDurationMs::MIN_VALUE, MedianDurationMs::MAX_VALUE),
            (1, 600_000)
        );
    }
}

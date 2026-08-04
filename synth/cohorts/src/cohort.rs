//! Dated cohorts, and the naming that makes their retirement derivable.
//!
//! A cohort is a test that comes into existence on a known date, is emitted for
//! a fixed number of days, and then stops. That gives it a genuine first
//! appearance and a genuine disappearance, which is the whole lifecycle a
//! new-test window is measured against.
//!
//! **Retirement is derivable from the name and nothing else.** Not from a state
//! file, not from a table of cohorts, not from a date range in configuration.
//! If it were tracked separately, an unplanned gap in the schedule — a delayed
//! or dropped scheduled run — would be indistinguishable from an intentional
//! retirement, and "resolved because the test retired" would be
//! indistinguishable from "resolved because our CI broke".
//!
//! The name carries both halves of what is needed:
//!
//! ```text
//! cohort_30d_born_2026_08_04
//!        └┬┘      └────┬────┘
//!         │            └─ birth date
//!         └─ emission window, in days
//! ```
//!
//! So `retires_on = birth + window`, computable by anyone reading the test name,
//! including someone reading it in the product with no access to this repo.

use std::fmt;

use chrono::{Days, NaiveDate};

/// The two cohort families, which differ only in how long they are emitted for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Family {
    /// Outlives the new-test window: new, then established, then gone. The
    /// full lifecycle.
    LongLived,
    /// Dies *before* the new-test window elapses, so it is never
    /// not-new. The deliberate contrast, and the cleanest illustration of
    /// resolution by absence.
    ShortLived,
}

impl Family {
    pub fn suite(&self) -> &'static str {
        match self {
            Self::LongLived => "LongLivedCohorts",
            Self::ShortLived => "ShortLivedCohorts",
        }
    }

    pub fn all() -> [Family; 2] {
        [Self::LongLived, Self::ShortLived]
    }
}

/// One cohort: a family, a birth date, and an emission window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Cohort {
    pub family: Family,
    pub born_on: NaiveDate,
    pub window_days: u64,
}

impl Cohort {
    pub fn new(family: Family, born_on: NaiveDate, window_days: u64) -> Self {
        Self {
            family,
            born_on,
            window_days,
        }
    }

    /// The test case name. This *is* the cohort's identity, so its format is
    /// fixed: changing it orphans the history of every cohort already in the
    /// product.
    pub fn test_name(&self) -> String {
        format!(
            "cohort_{}d_born_{}",
            self.window_days,
            self.born_on.format("%Y_%m_%d")
        )
    }

    /// The first day this cohort is no longer emitted.
    ///
    /// A cohort born on day 0 with a 30-day window is emitted on days 0 through
    /// 29 and retires on day 30 — thirty days of emission, not thirty-one.
    pub fn retires_on(&self) -> Option<NaiveDate> {
        self.born_on.checked_add_days(Days::new(self.window_days))
    }

    /// Whether this cohort should be emitted on `date`.
    pub fn is_alive_on(&self, date: NaiveDate) -> bool {
        match self.retires_on() {
            Some(retires_on) => date >= self.born_on && date < retires_on,
            None => date >= self.born_on,
        }
    }

    /// How many days old the cohort is on `date`. Negative before birth.
    pub fn age_in_days_on(&self, date: NaiveDate) -> i64 {
        (date - self.born_on).num_days()
    }

    /// The test case name, having checked that it parses back to this same
    /// cohort.
    ///
    /// The round trip is enforced at runtime rather than only in tests because
    /// the property it protects is the premise of the whole story: if a name
    /// stops being parseable, retirement stops being derivable from it, and an
    /// unplanned gap in the schedule becomes indistinguishable from an
    /// intentional retirement. Failing loudly here is much better than emitting
    /// a cohort nobody can date.
    pub fn checked_name(&self) -> Result<String, NameDrift> {
        let name = self.test_name();
        match Self::parse_name(self.family, &name) {
            Some(parsed) if parsed == *self => Ok(name),
            _ => Err(NameDrift { name }),
        }
    }

    /// Recover a cohort from its test name, which is the property that makes
    /// retirement derivable without any stored state.
    ///
    /// The family is not encoded in the name — only the window is, and the
    /// window is what determines behavior. Callers that need the family pass it
    /// in; anyone reading a name in the product only needs the window.
    pub fn parse_name(family: Family, name: &str) -> Option<Self> {
        let rest = name.strip_prefix("cohort_")?;
        let (window, rest) = rest.split_once("d_born_")?;
        Some(Self {
            family,
            born_on: NaiveDate::parse_from_str(rest, "%Y_%m_%d").ok()?,
            window_days: window.parse().ok()?,
        })
    }

    /// Every cohort of `family` that should be emitted on `on`.
    ///
    /// Cohorts are born every `birth_interval_days`, anchored to the calendar
    /// rather than to when this ran, so a missed run does not shift the schedule
    /// and every fork agrees on which cohorts exist.
    pub fn alive_on(
        family: Family,
        on: NaiveDate,
        window_days: u64,
        birth_interval_days: u64,
    ) -> Vec<Self> {
        let interval = birth_interval_days.max(1);
        let earliest = on
            .checked_sub_days(Days::new(window_days.saturating_sub(1)))
            .unwrap_or(on);

        let mut cohorts = Vec::new();
        let mut date = earliest;
        while date <= on {
            let cohort = Self::new(family, date, window_days);
            if is_birth_date(date, interval) && cohort.is_alive_on(on) {
                cohorts.push(cohort);
            }
            match date.checked_add_days(Days::new(1)) {
                Some(next) => date = next,
                None => break,
            }
        }
        cohorts
    }
}

/// A cohort whose name no longer parses back to itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NameDrift {
    pub name: String,
}

impl fmt::Display for NameDrift {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "cohort name {:?} does not parse back to the cohort that produced it, so its \
             retirement date is no longer derivable from the name",
            self.name
        )
    }
}

impl std::error::Error for NameDrift {}

impl fmt::Display for Cohort {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}::{}", self.family.suite(), self.test_name())
    }
}

/// Whether a cohort is born on `date`, given a birth interval.
///
/// Anchored to the day number since the Unix epoch so the answer depends only
/// on the date — not on when the generator ran, and not on any earlier run.
fn is_birth_date(date: NaiveDate, interval_days: u64) -> bool {
    if interval_days <= 1 {
        return true;
    }
    let epoch = NaiveDate::from_ymd_opt(1970, 1, 1).expect("the epoch is a valid date");
    let days_since_epoch = (date - epoch).num_days();
    days_since_epoch.rem_euclid(interval_days as i64) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    #[test]
    fn the_name_carries_both_the_birth_date_and_the_window() {
        let cohort = Cohort::new(Family::LongLived, date(2026, 8, 4), 30);
        assert_eq!(cohort.test_name(), "cohort_30d_born_2026_08_04");
    }

    #[test]
    fn retirement_is_recoverable_from_the_name_alone() {
        // This is the property the whole design rests on: given only a test
        // name — read off a screen in the product, with no access to this repo
        // and no stored state — the retirement date is computable.
        let parsed = Cohort::parse_name(Family::LongLived, "cohort_30d_born_2026_08_04")
            .expect("parses its own format");

        assert_eq!(parsed.born_on, date(2026, 8, 4));
        assert_eq!(parsed.window_days, 30);
        assert_eq!(parsed.retires_on(), Some(date(2026, 9, 3)));
    }

    #[test]
    fn names_round_trip() {
        for (window, born) in [(30, date(2026, 8, 4)), (10, date(2026, 1, 1))] {
            let cohort = Cohort::new(Family::ShortLived, born, window);
            let parsed =
                Cohort::parse_name(Family::ShortLived, &cohort.test_name()).expect("round trips");
            assert_eq!(cohort, parsed);
        }
    }

    #[test]
    fn nonsense_names_do_not_parse() {
        for name in [
            "healthcheck",
            "cohort_born_2026_08_04",
            "cohort_30d_born_not_a_date",
            "cohort_xd_born_2026_08_04",
        ] {
            assert!(
                Cohort::parse_name(Family::LongLived, name).is_none(),
                "{name:?} should not parse as a cohort"
            );
        }
    }

    #[test]
    fn a_thirty_day_window_emits_for_thirty_days_not_thirty_one() {
        let cohort = Cohort::new(Family::LongLived, date(2026, 8, 4), 30);

        assert!(!cohort.is_alive_on(date(2026, 8, 3)), "before birth");
        assert!(cohort.is_alive_on(date(2026, 8, 4)), "born today");
        assert!(cohort.is_alive_on(date(2026, 9, 2)), "day 29, the last day");
        assert!(!cohort.is_alive_on(date(2026, 9, 3)), "day 30, retired");

        let emitted = (0..40)
            .filter_map(|offset| date(2026, 8, 4).checked_add_days(Days::new(offset)))
            .filter(|d| cohort.is_alive_on(*d))
            .count();
        assert_eq!(emitted, 30);
    }

    #[test]
    fn short_lived_cohorts_die_before_the_new_test_window_elapses() {
        // The default new-test window is 14 days. A 10-day cohort is therefore
        // never not-new, which is the contrast the long-lived family exists to
        // set off.
        let short = Cohort::new(Family::ShortLived, date(2026, 8, 4), 10);
        let long = Cohort::new(Family::LongLived, date(2026, 8, 4), 30);
        let fourteen_days_in = date(2026, 8, 18);

        assert!(!short.is_alive_on(fourteen_days_in));
        assert!(long.is_alive_on(fourteen_days_in));
    }

    #[test]
    fn a_steady_state_day_has_one_alive_cohort_per_day_of_the_window() {
        let alive = Cohort::alive_on(Family::LongLived, date(2026, 8, 4), 30, 1);
        assert_eq!(alive.len(), 30);

        // Oldest is 29 days old and about to retire; youngest was born today.
        assert_eq!(alive[0].age_in_days_on(date(2026, 8, 4)), 29);
        assert_eq!(alive[29].age_in_days_on(date(2026, 8, 4)), 0);
        assert!(alive.iter().all(|c| c.is_alive_on(date(2026, 8, 4))));
    }

    #[test]
    fn a_birth_interval_thins_the_cohort_without_shifting_it() {
        let every_third = Cohort::alive_on(Family::LongLived, date(2026, 8, 4), 30, 3);
        assert_eq!(every_third.len(), 10);

        // Anchored to the calendar, not to when this ran: asking on a later day
        // returns the same birth dates for the cohorts that are still alive.
        let next_day = Cohort::alive_on(Family::LongLived, date(2026, 8, 5), 30, 3);
        let overlap: Vec<NaiveDate> = every_third
            .iter()
            .filter(|c| c.is_alive_on(date(2026, 8, 5)))
            .map(|c| c.born_on)
            .collect();
        for born_on in overlap {
            assert!(
                next_day.iter().any(|c| c.born_on == born_on),
                "{born_on} disappeared between consecutive days"
            );
        }
    }

    #[test]
    fn the_alive_set_turns_over_exactly_once_per_window() {
        let start = date(2026, 8, 4);
        let today = Cohort::alive_on(Family::ShortLived, start, 10, 1);
        let a_window_later = Cohort::alive_on(
            Family::ShortLived,
            start.checked_add_days(Days::new(10)).expect("valid date"),
            10,
            1,
        );

        // Not one cohort in common: every test a viewer sees today is gone in
        // ten days, which is what exercises resolution by absence.
        for cohort in &today {
            assert!(!a_window_later.contains(cohort), "{cohort} survived");
        }
    }
}

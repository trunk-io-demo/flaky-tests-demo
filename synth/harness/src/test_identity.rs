//! Test identity, derived rather than generated. Nothing here touches the RNG:
//! one differing byte makes the product see a brand-new test.

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct TestIdentity {
    pub suite: String,
    pub name: String,
    pub classname: String,
    pub file: String,
}

impl TestIdentity {
    /// The class joins `classname` and the file path, so it is part of identity the
    /// same way the suite is. A test with no natural class still gets one.
    pub fn in_class(story_id: &str, suite: &str, class: &str, name: &str) -> Self {
        Self {
            suite: suite.to_owned(),
            name: name.to_owned(),
            classname: format!("synth.{story_id}.{suite}.{class}"),
            file: format!(
                "synth/{story_id}/{}/{}.ts",
                to_snake_case(suite),
                to_snake_case(class)
            ),
        }
    }
}

impl fmt::Display for TestIdentity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}::{}", self.classname, self.name)
    }
}

fn to_snake_case(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let mut out = String::with_capacity(input.len() + 4);

    for (i, &c) in chars.iter().enumerate() {
        if c == '-' || c == ' ' || c == '.' {
            out.push('_');
            continue;
        }
        if c.is_ascii_uppercase() {
            let previous_was_lower = i > 0 && chars[i - 1].is_ascii_lowercase();
            let next_is_lower = chars.get(i + 1).is_some_and(char::is_ascii_lowercase);
            let starts_a_word = i > 0 && (previous_was_lower || next_is_lower);
            if starts_a_word && !out.ends_with('_') {
                out.push('_');
            }
            out.push(c.to_ascii_lowercase());
            continue;
        }
        out.push(c);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_is_fully_derived_from_its_three_inputs() {
        let a = TestIdentity::in_class("cohorts", "CheckoutFlow", "Class00", "applies_promo_code");
        let b = TestIdentity::in_class("cohorts", "CheckoutFlow", "Class00", "applies_promo_code");
        assert_eq!(a, b);
    }

    #[test]
    fn every_input_changes_the_identity() {
        let base =
            TestIdentity::in_class("cohorts", "CheckoutFlow", "Class00", "applies_promo_code");
        assert_ne!(
            base,
            TestIdentity::in_class(
                "branch-rates",
                "CheckoutFlow",
                "Class00",
                "applies_promo_code"
            )
        );
        assert_ne!(
            base,
            TestIdentity::in_class("cohorts", "CartTotals", "Class00", "applies_promo_code")
        );
        assert_ne!(
            base,
            TestIdentity::in_class(
                "cohorts",
                "CheckoutFlow",
                "Class00",
                "rejects_expired_promo_code"
            )
        );
    }

    #[test]
    fn derived_fields_are_pinned() {
        let id = TestIdentity::in_class("cohorts", "CheckoutFlow", "Class00", "applies_promo_code");
        assert_eq!(id.suite, "CheckoutFlow");
        assert_eq!(id.name, "applies_promo_code");
        assert_eq!(id.classname, "synth.cohorts.CheckoutFlow.Class00");
        assert_eq!(id.file, "synth/cohorts/checkout_flow/class00.ts");
        assert_eq!(
            id.to_string(),
            "synth.cohorts.CheckoutFlow.Class00::applies_promo_code"
        );
    }

    #[test]
    fn snake_case_handles_the_shapes_suite_names_actually_take() {
        assert_eq!(to_snake_case("CheckoutFlow"), "checkout_flow");
        assert_eq!(to_snake_case("HTTPRetry"), "http_retry");
        assert_eq!(to_snake_case("Cart"), "cart");
        assert_eq!(to_snake_case("cart"), "cart");
        assert_eq!(to_snake_case("release-1"), "release_1");
        assert_eq!(to_snake_case("Cohort2026"), "cohort2026");
    }

    #[test]
    fn a_class_joins_the_classname_and_the_path() {
        let id = TestIdentity::in_class("fabricated", "Suite03", "Class01", "test_05");
        assert_eq!(id.suite, "Suite03");
        assert_eq!(id.name, "test_05");
        assert_eq!(id.classname, "synth.fabricated.Suite03.Class01");
        assert_eq!(id.file, "synth/fabricated/suite03/class01.ts");
    }

    #[test]
    fn a_class_makes_two_otherwise_identical_tests_distinct() {
        let first = TestIdentity::in_class("fabricated", "Suite03", "Class00", "test_05");
        let second = TestIdentity::in_class("fabricated", "Suite03", "Class01", "test_05");
        assert_ne!(first, second);
        assert_eq!(first.suite, second.suite);
    }
}

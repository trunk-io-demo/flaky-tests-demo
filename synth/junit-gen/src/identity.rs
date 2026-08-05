//! Test identity, owned explicitly.
//!
//! A test's identity in the product is derived from the tuple of repository,
//! `file`, `classname`, suite path, `name`, and variant. Every field must be
//! byte-identical across runs or the product sees a brand-new test rather than
//! another run of an existing one.
//!
//! That is why this module exists and why nothing in it touches the RNG.
//! Generic JUnit mock generation is unusable for `synth/` for exactly this
//! reason: it assigns a random `file` per case and pairs names with classnames
//! by independent shuffle, so no test it emits can ever be emitted twice.

use std::fmt;

/// Everything about a test case that contributes to its identity.
///
/// Construct through [`TestIdentity::in_suite`] so that `classname` and `file`
/// are derived rather than typed, which is what keeps two call sites from
/// disagreeing about a test they both mean to be the same one.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct TestIdentity {
    /// The JUnit `<testsuite name>`.
    pub suite: String,
    /// The JUnit `<testcase name>`. For dated cohorts this encodes the
    /// creation date, which is what gives each cohort a genuine first
    /// appearance.
    pub name: String,
    /// The JUnit `<testcase classname>`.
    pub classname: String,
    /// The JUnit `file` attribute. Also what CODEOWNERS matching runs against,
    /// so it has to look like a path someone could own.
    pub file: String,
}

impl TestIdentity {
    /// Derive an identity from a story ID, a suite name, and a case name.
    ///
    /// The derivation is deliberately boring and total: given the same three
    /// inputs it produces the same four fields, on any machine, forever.
    ///
    /// ```
    /// # use junit_gen::TestIdentity;
    /// let id = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code");
    /// assert_eq!(id.classname, "synth.cohorts.CheckoutFlow");
    /// assert_eq!(id.file, "synth/cohorts/checkout_flow.ts");
    /// ```
    pub fn in_suite(story_id: &str, suite: &str, name: &str) -> Self {
        Self {
            suite: suite.to_owned(),
            name: name.to_owned(),
            classname: format!("synth.{story_id}.{suite}"),
            file: format!("synth/{story_id}/{}.ts", to_snake_case(suite)),
        }
    }

    /// Override the derived `file` path. Use only where the story is *about*
    /// the path — CODEOWNERS attribution, for instance. Overriding it changes
    /// the test's identity, so an existing story's history does not carry over.
    pub fn with_file(mut self, file: impl Into<String>) -> Self {
        self.file = file.into();
        self
    }
}

impl fmt::Display for TestIdentity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}::{}", self.classname, self.name)
    }
}

/// `CheckoutFlow` -> `checkout_flow`, `HTTPRetry` -> `http_retry`.
///
/// Only used for deriving plausible file paths, but it is part of identity all
/// the same, so it is pinned by tests.
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
        let a = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code");
        let b = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code");
        assert_eq!(a, b);
    }

    #[test]
    fn every_input_changes_the_identity() {
        let base = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code");
        assert_ne!(
            base,
            TestIdentity::in_suite("branch-rates", "CheckoutFlow", "applies_promo_code")
        );
        assert_ne!(
            base,
            TestIdentity::in_suite("cohorts", "CartTotals", "applies_promo_code")
        );
        assert_ne!(
            base,
            TestIdentity::in_suite("cohorts", "CheckoutFlow", "rejects_expired_promo_code")
        );
    }

    #[test]
    fn derived_fields_are_pinned() {
        // Golden values. Changing these orphans the history of every synthetic
        // test already in the product.
        let id = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code");
        assert_eq!(id.suite, "CheckoutFlow");
        assert_eq!(id.name, "applies_promo_code");
        assert_eq!(id.classname, "synth.cohorts.CheckoutFlow");
        assert_eq!(id.file, "synth/cohorts/checkout_flow.ts");
        assert_eq!(
            id.to_string(),
            "synth.cohorts.CheckoutFlow::applies_promo_code"
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
    fn overriding_the_file_leaves_the_rest_alone() {
        let id = TestIdentity::in_suite("cohorts", "CheckoutFlow", "applies_promo_code")
            .with_file("apps/billing/promo.ts");
        assert_eq!(id.file, "apps/billing/promo.ts");
        assert_eq!(id.classname, "synth.cohorts.CheckoutFlow");
    }
}

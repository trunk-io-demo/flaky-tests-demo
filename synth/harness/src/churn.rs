//! Names for the disposable tests, generated rather than written.
//!
//! Drawn through the story's own RNG so a run reproduces, and pinned to one
//! version of `fake`: its word lists are not a stability guarantee, and a bump
//! that changed them would rename tests. Only the churn set may use these — a
//! generated name on a durable test means a dependency bump orphans its history.

use fake::faker::company::en::{BsAdj, BsNoun, BsVerb};
use fake::Fake;

use crate::seed::StoryRng;

pub fn name(rng: &mut StoryRng) -> String {
    let verb: String = BsVerb().fake_with_rng(rng.inner());
    let adjective: String = BsAdj().fake_with_rng(rng.inner());
    let noun: String = BsNoun().fake_with_rng(rng.inner());
    to_snake_case(&format!("{verb} {adjective} {noun}"))
}

fn to_snake_case(phrase: &str) -> String {
    let mut out = String::with_capacity(phrase.len());
    for character in phrase.chars() {
        if character.is_ascii_alphanumeric() {
            out.push(character.to_ascii_lowercase());
        } else if !out.ends_with('_') {
            out.push('_');
        }
    }
    out.trim_matches('_').to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::DateBucket;
    use chrono::NaiveDate;

    fn bucket() -> DateBucket {
        DateBucket::Day(NaiveDate::from_ymd_opt(2026, 8, 5).expect("valid date"))
    }

    #[test]
    fn the_same_seed_generates_the_same_names() {
        let mut first = StoryRng::derive("churn", bucket());
        let mut second = StoryRng::derive("churn", bucket());

        let a: Vec<String> = (0..16).map(|_| name(&mut first)).collect();
        let b: Vec<String> = (0..16).map(|_| name(&mut second)).collect();
        assert_eq!(a, b);
    }

    #[test]
    fn names_are_snake_case_and_usable_as_test_names() {
        let mut rng = StoryRng::derive("churn", bucket());
        for _ in 0..64 {
            let generated = name(&mut rng);
            assert!(!generated.is_empty());
            assert!(
                !generated.starts_with('_') && !generated.ends_with('_'),
                "{generated}"
            );
            assert!(
                generated
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "{generated}"
            );
            assert!(!generated.contains("__"), "{generated}");
        }
    }

    #[test]
    fn the_generator_produces_more_than_a_handful_of_distinct_names() {
        let mut rng = StoryRng::derive("churn", bucket());
        let generated: std::collections::BTreeSet<String> =
            (0..200).map(|_| name(&mut rng)).collect();
        assert!(generated.len() > 150, "only {} distinct", generated.len());
    }

    #[test]
    fn punctuation_and_spacing_collapse_to_single_underscores() {
        assert_eq!(
            to_snake_case("Deliver  Best-of-Breed  E-Markets"),
            "deliver_best_of_breed_e_markets"
        );
        assert_eq!(
            to_snake_case("  leading and trailing  "),
            "leading_and_trailing"
        );
    }
}

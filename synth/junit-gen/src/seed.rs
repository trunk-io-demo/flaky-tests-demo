//! Derived seeds and fabricated SHAs. FNV-1a and ChaCha8 because `DefaultHasher`
//! and `StdRng` are not stable across Rust releases, and a fork has to reproduce
//! the original's stories exactly.

use chrono::{DateTime, NaiveDate, Timelike, Utc};
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

pub fn stable_hash(parts: &[&str]) -> u64 {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    const SEPARATOR: u8 = 0x1f;

    let mut hash = OFFSET_BASIS;
    let mut mix = |byte: u8| {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(PRIME);
    };

    for (i, part) in parts.iter().enumerate() {
        if i > 0 {
            mix(SEPARATOR);
        }
        for byte in part.as_bytes() {
            mix(*byte);
        }
    }
    hash
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DateBucket {
    Day(NaiveDate),
    Hour(NaiveDate, u32),
}

impl DateBucket {
    pub fn day_of(at: DateTime<Utc>) -> Self {
        Self::Day(at.date_naive())
    }

    pub fn hour_of(at: DateTime<Utc>) -> Self {
        Self::Hour(at.date_naive(), at.hour())
    }

    pub fn key(&self) -> String {
        match self {
            Self::Day(date) => date.format("%Y-%m-%d").to_string(),
            Self::Hour(date, hour) => format!("{}T{hour:02}", date.format("%Y-%m-%d")),
        }
    }

    pub fn date(&self) -> NaiveDate {
        match self {
            Self::Day(date) | Self::Hour(date, _) => *date,
        }
    }
}

#[derive(Debug, Clone)]
pub struct StoryRng {
    seed: u64,
    rng: ChaCha8Rng,
}

impl StoryRng {
    pub fn derive(story_id: &str, bucket: DateBucket) -> Self {
        Self::from_seed(stable_hash(&[story_id, &bucket.key()]))
    }

    pub fn derive_with(story_id: &str, bucket: DateBucket, discriminator: &str) -> Self {
        Self::from_seed(stable_hash(&[story_id, &bucket.key(), discriminator]))
    }

    pub fn from_seed(seed: u64) -> Self {
        Self {
            seed,
            rng: ChaCha8Rng::seed_from_u64(seed),
        }
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }

    pub fn chance(&mut self, percent: u8) -> bool {
        if percent == 0 {
            return false;
        }
        if percent >= 100 {
            return true;
        }
        self.rng.gen_range(0..100u8) < percent
    }

    pub fn in_range(&mut self, low: u64, high: u64) -> u64 {
        if high <= low {
            return low;
        }
        self.rng.gen_range(low..=high)
    }

    pub fn pick<'a, T>(&mut self, choices: &'a [T]) -> &'a T {
        assert!(!choices.is_empty(), "cannot pick from an empty slice");
        let index = self.rng.gen_range(0..choices.len());
        &choices[index]
    }

    pub fn inner(&mut self) -> &mut ChaCha8Rng {
        &mut self.rng
    }
}

pub fn fabricated_sha(parts: &[&str]) -> String {
    let mut rng = ChaCha8Rng::seed_from_u64(stable_hash(parts));
    let mut bytes = [0u8; 20];
    rng.fill(&mut bytes);

    let mut sha = String::with_capacity(40);
    for byte in bytes {
        sha.push(nibble_to_hex(byte >> 4));
        sha.push(nibble_to_hex(byte & 0x0f));
    }
    sha
}

fn nibble_to_hex(nibble: u8) -> char {
    match nibble {
        0..=9 => (b'0' + nibble) as char,
        _ => (b'a' + nibble - 10) as char,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    #[test]
    fn stable_hash_is_pinned_to_known_values() {
        assert_eq!(stable_hash(&[""]), 0xcbf2_9ce4_8422_2325);
        assert_eq!(stable_hash(&["cohorts"]), 13_691_230_509_077_451_169);
        assert_eq!(
            stable_hash(&["cohorts", "2026-08-04"]),
            11_383_335_509_363_930_594
        );
    }

    #[test]
    fn stable_hash_separates_parts() {
        assert_ne!(stable_hash(&["ab", "c"]), stable_hash(&["a", "bc"]));
        assert_ne!(stable_hash(&["a", ""]), stable_hash(&["a"]));
    }

    #[test]
    fn same_story_and_bucket_reproduce_the_same_stream() {
        let bucket = DateBucket::Day(date(2026, 8, 4));
        let mut first = StoryRng::derive("cohorts", bucket);
        let mut second = StoryRng::derive("cohorts", bucket);

        assert_eq!(first.seed(), second.seed());
        let a: Vec<u64> = (0..16).map(|_| first.in_range(0, u64::MAX)).collect();
        let b: Vec<u64> = (0..16).map(|_| second.in_range(0, u64::MAX)).collect();
        assert_eq!(a, b);
    }

    #[test]
    fn different_buckets_and_discriminators_diverge() {
        let monday = DateBucket::Day(date(2026, 8, 3));
        let tuesday = DateBucket::Day(date(2026, 8, 4));

        assert_ne!(
            StoryRng::derive("cohorts", monday).seed(),
            StoryRng::derive("cohorts", tuesday).seed()
        );
        assert_ne!(
            StoryRng::derive("cohorts", monday).seed(),
            StoryRng::derive("branch-rates", monday).seed()
        );
        assert_ne!(
            StoryRng::derive_with("cohorts", monday, "main").seed(),
            StoryRng::derive_with("cohorts", monday, "release/1.0.0").seed()
        );
    }

    #[test]
    fn bucket_keys_are_stable_and_distinct() {
        assert_eq!(DateBucket::Day(date(2026, 8, 4)).key(), "2026-08-04");
        assert_eq!(DateBucket::Hour(date(2026, 8, 4), 7).key(), "2026-08-04T07");
        assert_ne!(
            DateBucket::Hour(date(2026, 8, 4), 7).key(),
            DateBucket::Hour(date(2026, 8, 4), 17).key()
        );
    }

    #[test]
    fn chance_honors_its_bounds() {
        let mut rng = StoryRng::from_seed(7);
        assert!(!rng.chance(0));
        assert!(rng.chance(100));

        let hits = (0..1000).filter(|_| rng.chance(25)).count();
        assert!((200..300).contains(&hits), "25% of 1000 drew {hits}");
    }

    #[test]
    fn fabricated_shas_look_like_shas_and_are_stable() {
        let sha = fabricated_sha(&["cohorts", "2026-08-04"]);
        assert_eq!(sha.len(), 40);
        assert!(sha
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()));
        assert_eq!(sha, fabricated_sha(&["cohorts", "2026-08-04"]));
        assert_ne!(sha, fabricated_sha(&["cohorts", "2026-08-05"]));
    }
}

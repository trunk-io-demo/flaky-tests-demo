//! Drawing a duration from a shape. Normal, not uniform: a uniform range gives
//! failures the same distribution as passes, and no tail for a quintile monitor
//! to read.
//!
//! The shape's three-sigma bounds are the clamp, which is also what keeps a
//! negative tail off a duration.

use std::time::Duration;

use rand_distr::{Distribution as _, Normal};
use synth_config::Distribution;

use crate::seed::StoryRng;

pub fn draw(rng: &mut StoryRng, shape: &Distribution) -> Duration {
    let spread = shape.spread_ms();
    if spread == 0 {
        return Duration::from_millis(shape.median_ms());
    }

    #[allow(clippy::cast_precision_loss)]
    let normal = Normal::new(shape.median_ms() as f64, spread as f64)
        .expect("a positive spread is a valid normal distribution");

    #[allow(clippy::cast_precision_loss, clippy::cast_sign_loss)]
    let drawn = normal
        .sample(rng.inner())
        .round()
        .clamp(shape.low_ms() as f64, shape.high_ms() as f64) as u64;

    Duration::from_millis(drawn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;
    use synth_config::{DurationSpreadMs, MedianDurationMs};

    fn bucket() -> crate::seed::DateBucket {
        crate::seed::DateBucket::Day(NaiveDate::from_ymd_opt(2026, 8, 5).expect("valid date"))
    }

    fn shape(median: u64, spread: u64) -> Distribution {
        Distribution::new(
            "test",
            MedianDurationMs::new(median).expect("in range"),
            DurationSpreadMs::new(spread).expect("in range"),
        )
    }

    #[test]
    fn the_same_seed_draws_the_same_durations() {
        let mut first = StoryRng::derive("draw", bucket());
        let mut second = StoryRng::derive("draw", bucket());
        let shape = shape(1_000, 300);

        for _ in 0..32 {
            assert_eq!(draw(&mut first, &shape), draw(&mut second, &shape));
        }
    }

    #[test]
    fn draws_stay_inside_three_sigma_and_never_reach_zero() {
        let mut rng = StoryRng::derive("draw", bucket());
        let shape = shape(100, 500);

        for _ in 0..512 {
            let drawn = draw(&mut rng, &shape).as_millis() as u64;
            assert!(
                (shape.low_ms()..=shape.high_ms()).contains(&drawn),
                "{drawn}"
            );
            assert!(drawn >= 1, "a duration of {drawn}ms");
        }
    }

    #[test]
    fn a_zero_spread_is_the_median_exactly() {
        let mut rng = StoryRng::derive("draw", bucket());
        let shape = shape(2_500, 0);
        assert_eq!(draw(&mut rng, &shape), Duration::from_millis(2_500));
    }

    #[test]
    fn the_draws_cluster_around_the_median_rather_than_spreading_evenly() {
        let mut rng = StoryRng::derive("draw", bucket());
        let shape = shape(3_000, 1_000);

        let within_one_sigma = (0..1_000)
            .map(|_| draw(&mut rng, &shape).as_millis() as u64)
            .filter(|ms| (2_000..=4_000).contains(ms))
            .count();

        assert!(
            (600..800).contains(&within_one_sigma),
            "a normal puts about 68% inside one sigma, got {within_one_sigma} of 1000"
        );
    }
}

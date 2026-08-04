//! Emits dated test cohorts: tests with a genuine first appearance and a
//! genuine disappearance.
//!
//! Two families run side by side. The long-lived one outlives the new-test
//! window, so it goes new, then established, then gone. The short-lived one
//! dies before the window elapses, so it is never not-new. Reading them
//! together is what makes the window itself visible.
//!
//! Run it:
//!
//! ```text
//! SYNTH_REPO_URL=https://github.com/your-org/your-fork cargo run -p cohorts
//! ```

mod cohort;

use anyhow::Result;
use clap::Parser;
use junit_gen::report::{write_report, Durations};
use junit_gen::{
    render, Attribution, CommonArgs, DateBucket, Manifest, Outcome, ReportSpec, StoryRng,
    TestCaseSpec, TestIdentity, UploadEntry,
};

use crate::cohort::{Cohort, Family};

/// The story ID. Part of every seed and every test identity in this generator,
/// so it is fixed.
const STORY_ID: &str = "cohorts";

#[derive(Debug, Parser)]
#[command(
    name = "cohorts",
    about = "Generate dated test cohorts whose retirement is derivable from the test name."
)]
struct Args {
    #[command(flatten)]
    common: CommonArgs,

    /// Days a long-lived cohort is emitted for.
    ///
    /// Must exceed the new-test window — 14 days by default — or this family
    /// stops being the contrast to the short-lived one and the story collapses
    /// into one shape.
    #[arg(long, env = "SYNTH_COHORT_LONG_WINDOW_DAYS", default_value = "30")]
    long_window_days: u64,

    /// Days a short-lived cohort is emitted for.
    ///
    /// Must be *under* the new-test window, so these cohorts are never
    /// not-new.
    #[arg(long, env = "SYNTH_COHORT_SHORT_WINDOW_DAYS", default_value = "10")]
    short_window_days: u64,

    /// Days between cohort births.
    ///
    /// 1 means a new test appears every day, which is the clearest version of
    /// the story and also the most test cases. Raising it thins both.
    #[arg(long, env = "SYNTH_COHORT_BIRTH_INTERVAL_DAYS", default_value = "1")]
    birth_interval_days: u64,

    /// Percentage of runs in which a cohort fails.
    ///
    /// Cohorts would tell their lifecycle story at zero — the arc is about
    /// appearing and disappearing, not about failing — but a little flakiness
    /// makes them visible in the places a viewer is already looking.
    #[arg(long, env = "SYNTH_COHORTS_FAILURE_RATE", default_value = "12")]
    failure_rate: u8,

    /// Percentage of runs in which a cohort is skipped rather than run.
    #[arg(long, env = "SYNTH_COHORTS_SKIP_RATE", default_value = "3")]
    skip_rate: u8,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let now = args.common.now();
    let today = now.date_naive();

    // Structure is decided per day; outcomes are drawn per hour. An hourly
    // schedule then produces genuinely different runs through the day while
    // staying reproducible, and a cohort's membership does not depend on how
    // many times the schedule fired.
    let outcome_bucket = DateBucket::hour_of(now);
    let mut rng = args
        .common
        .seed
        .map(StoryRng::from_seed)
        .unwrap_or_else(|| StoryRng::derive(STORY_ID, outcome_bucket));

    let mut spec = ReportSpec::new("synth-cohorts", now);
    let durations = Durations::default();

    // A healthcheck that always passes, for the same reason every monitors/
    // package has one: several monitors resolve on absence of data, so a viewer
    // needs to be able to tell "the cohort retired" from "the generator stopped
    // reporting". This test never retires.
    spec.push(TestCaseSpec::new(
        TestIdentity::in_suite(STORY_ID, "Healthcheck", "cohort_generator_is_reporting"),
        Outcome::Pass,
        durations.draw(&mut rng, Outcome::Pass),
    ));

    let mut alive_counts = Vec::new();
    for family in Family::all() {
        let window = match family {
            Family::LongLived => args.long_window_days,
            Family::ShortLived => args.short_window_days,
        };
        let cohorts = Cohort::alive_on(family, today, window, args.birth_interval_days);
        alive_counts.push((family, cohorts.len()));

        for cohort in cohorts {
            // Checked rather than formatted: the name has to parse back to this
            // cohort, or retirement is no longer derivable from it and the story
            // has quietly stopped being the one described in the README.
            let test_name = cohort.checked_name()?;

            // Each cohort gets its own stream. Sharing one would correlate their
            // outcomes, and a whole family failing together on the same run
            // reads as a real common cause rather than as independent flakiness.
            let mut cohort_rng = StoryRng::derive_with(STORY_ID, outcome_bucket, &test_name);

            let outcome = if cohort_rng.chance(args.skip_rate) {
                Outcome::Skip
            } else if cohort_rng.chance(args.failure_rate) {
                Outcome::Fail
            } else {
                Outcome::Pass
            };

            let identity = TestIdentity::in_suite(STORY_ID, family.suite(), &test_name);
            let mut case =
                TestCaseSpec::new(identity, outcome, durations.draw(&mut cohort_rng, outcome));

            if outcome == Outcome::Fail {
                case = case.with_message(format!(
                    "synthetic failure on day {} of a {}-day cohort (retires {})",
                    cohort.age_in_days_on(today),
                    cohort.window_days,
                    cohort
                        .retires_on()
                        .map(|d| d.to_string())
                        .unwrap_or_else(|| "never".to_owned()),
                ));
            }
            spec.push(case);
        }
    }

    // Cohorts are a protected-branch story. Their arc is about a test's
    // lifetime, which is only legible against the branch that accumulates
    // history rather than against short-lived pull requests.
    let protected = args.common.protected();
    let branch = protected
        .first()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no protected branches configured; set --protected-branches to the branch this \
                 org protects, or cohorts will upload as NONE instead of PB"
            )
        })?
        .to_owned();

    let base = args
        .common
        .attribution_base(&[STORY_ID, &outcome_bucket.key()]);
    let attribution = Attribution::on_protected_branch(base, &branch, &protected)?;

    let out_dir = args.common.out_dir.join(STORY_ID);
    let report = render(&spec);
    let junit_path = write_report(&out_dir, "junit.xml", &report)?;

    let mut manifest = Manifest::new();
    manifest.push(UploadEntry::new(
        junit_path.to_string_lossy().into_owned(),
        format!("cohorts: {} alive cohorts on {today}", spec.cases.len() - 1),
        &attribution,
    ));
    let manifest_path = manifest.write(&out_dir)?;

    if !args.common.quiet {
        println!("cohorts: seed {}", rng.seed());
        println!("cohorts: bucket {}", outcome_bucket.key());
        for (family, count) in &alive_counts {
            println!("cohorts: {} alive in {}", count, family.suite());
        }
        println!("cohorts: wrote {}", junit_path.display());
        println!("cohorts: wrote {}", manifest_path.display());
    }

    Ok(())
}

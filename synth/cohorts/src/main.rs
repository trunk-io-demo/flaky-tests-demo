//! Dated test cohorts: one family outlives the new-test window, one dies before
//! it. Reading them together is what makes the window visible.

mod cohort;

use anyhow::Result;
use clap::Parser;
use junit_gen::report::{write_report, Durations};
use junit_gen::{
    render, Attribution, CommonArgs, DateBucket, Manifest, Outcome, ReportSpec, StoryRng,
    TestCaseSpec, TestIdentity, UploadEntry,
};

use crate::cohort::{Cohort, Family};

const STORY_ID: &str = "cohorts";

#[derive(Debug, Parser)]
#[command(
    name = "cohorts",
    about = "Generate dated test cohorts whose retirement is derivable from the test name."
)]
struct Args {
    #[command(flatten)]
    common: CommonArgs,

    #[arg(long, env = "SYNTH_COHORT_LONG_WINDOW_DAYS", default_value = "30")]
    long_window_days: u64,

    #[arg(long, env = "SYNTH_COHORT_SHORT_WINDOW_DAYS", default_value = "10")]
    short_window_days: u64,

    #[arg(long, env = "SYNTH_COHORT_BIRTH_INTERVAL_DAYS", default_value = "1")]
    birth_interval_days: u64,

    #[arg(long, env = "SYNTH_COHORTS_FAILURE_RATE", default_value = "12")]
    failure_rate: u8,

    #[arg(long, env = "SYNTH_COHORTS_SKIP_RATE", default_value = "3")]
    skip_rate: u8,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let now = args.common.now();
    let today = now.date_naive();

    let outcome_bucket = DateBucket::hour_of(now);
    let mut rng = args
        .common
        .seed
        .map(StoryRng::from_seed)
        .unwrap_or_else(|| StoryRng::derive(STORY_ID, outcome_bucket));

    let mut spec = ReportSpec::new("synth-cohorts", now);
    let durations = Durations::default();

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
            let test_name = cohort.checked_name()?;

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

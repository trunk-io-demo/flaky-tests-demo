//! The synth generator. Nothing here executes a test, and nothing here attributes
//! an upload: it writes JUnit and prints the paths.
//!
//! One binary, invoked once per story. The workflow decides what an upload claims
//! by setting the variables the uploader already reads, and `SYNTH_FAILURE_RATE`
//! decides how much of the run fails.

mod plan;

use anyhow::Result;
use chrono::{DateTime, Utc};
use clap::Parser;
use harness::report::write_report;
use harness::{render, ReportSpec};
use std::path::PathBuf;
use synth_config::Params;

#[derive(Debug, Parser)]
#[command(
    name = "generate",
    about = "Fabricate synthetic JUnit and an upload manifest. Runs no tests."
)]
struct Args {
    #[arg(long, default_value = "synth-out")]
    out_dir: PathBuf,

    #[arg(long)]
    now: Option<DateTime<Utc>>,

    #[arg(long)]
    quiet: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let loaded = Params::load();
    let params = loaded.params;

    for notice in &loaded.notices {
        println!("::warning title=synth config::{notice}");
    }

    let now = args.now.unwrap_or_else(Utc::now);

    let mut written = Vec::new();
    let mut failures = 0;

    for (index, cases) in plan::reports(&params, now).into_iter().enumerate() {
        failures += cases
            .iter()
            .filter(|case| case.outcome.is_failure())
            .count();
        let mut spec = ReportSpec::new(format!("synth-tests-{index:02}"), now);
        spec.extend(cases);
        written.push(write_report(
            &args.out_dir,
            &format!("junit-tests-{index:02}.xml"),
            &render(&spec),
        )?);
    }

    let mut healthcheck = ReportSpec::new("synth-healthcheck", now);
    healthcheck.push(plan::healthcheck(&params, now));
    written.push(write_report(
        &args.out_dir,
        "junit-healthcheck.xml",
        &render(&healthcheck),
    )?);

    if !args.quiet {
        println!("synth: hour {}", harness::DateBucket::hour_of(now).key());
        println!(
            "synth: {} tests x {} runs in {} suites across {} reports",
            params.total_tests(),
            params.runs_per_test,
            params.suite_count(),
            params.report_count()
        );
        println!(
            "synth: {} cases, {failures} failing at {}%",
            params.total_cases(),
            params.failure_rate
        );
        for path in &written {
            println!("synth: wrote {}", path.display());
        }
    }

    Ok(())
}

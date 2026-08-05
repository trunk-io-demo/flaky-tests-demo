//! Runs generated JUnit through the uploader's own `validate` subcommand, which
//! parses it exactly as an upload would and sends nothing. Skipped when
//! `TRUNK_ANALYTICS_CLI` is unset.

use std::process::Command;
use std::time::Duration;

use chrono::Utc;
use junit_gen::report::{write_report, Durations};
use junit_gen::{render, DateBucket, Outcome, ReportSpec, StoryRng, TestCaseSpec, TestIdentity};

fn sample_report() -> ReportSpec {
    let timestamp = Utc::now();
    let bucket = DateBucket::day_of(timestamp);
    let mut rng = StoryRng::derive("validate-fixture", bucket);
    let durations = Durations::default();

    let mut spec = ReportSpec::new("synth-validate-fixture", timestamp);
    for (suite, name, outcome) in [
        ("CheckoutFlow", "applies_promo_code", Outcome::Pass),
        ("CheckoutFlow", "rejects_expired_card", Outcome::Fail),
        ("CheckoutFlow", "skips_when_cart_empty", Outcome::Skip),
        (
            "CartTotals",
            "settles_after_retry",
            Outcome::PassAfterRetries { failures: 2 },
        ),
    ] {
        let duration = durations.draw(&mut rng, outcome);
        let mut case = TestCaseSpec::new(
            TestIdentity::in_suite("validate-fixture", suite, name),
            outcome,
            duration,
        );
        if matches!(outcome, Outcome::PassAfterRetries { .. }) {
            case = case.with_retry_duration(Duration::from_secs(30));
        }
        spec.push(case);
    }
    spec
}

#[test]
fn generated_junit_passes_the_uploaders_validator() {
    let Some(cli) = std::env::var_os("TRUNK_ANALYTICS_CLI") else {
        eprintln!(
            "skipping: set TRUNK_ANALYTICS_CLI to the uploader binary to validate generated JUnit"
        );
        return;
    };

    let dir = std::env::temp_dir().join(format!(
        "junit-gen-validate-{}-{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    let report = render(&sample_report());
    let path = write_report(&dir, "junit.xml", &report).expect("writes the report");

    let output = Command::new(&cli)
        .arg("validate")
        .arg("--junit-paths")
        .arg(&path)
        .output()
        .expect("runs the uploader's validator");

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    std::fs::remove_dir_all(&dir).ok();

    assert!(
        output.status.success(),
        "validate failed\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );

    let combined = format!("{stdout}{stderr}");
    assert!(
        !combined.contains("⚠️"),
        "validator reported warnings\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );

    assert!(
        combined.contains("2 test suites, 4 test cases"),
        "validator did not see the expected structure\n--- stdout ---\n{stdout}\n--- stderr ---\n{stderr}"
    );
}

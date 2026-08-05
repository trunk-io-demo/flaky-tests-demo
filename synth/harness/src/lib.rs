//! Shared library for `synth/`. Nothing here executes a test, and nothing here
//! attributes an upload: the workflow sets the variables the uploader already
//! reads.
//!
//! Two properties are load-bearing. Identity must be byte-identical across runs
//! or the product sees a new test rather than another run of an existing one, so
//! it is derived and never drawn from the RNG. And seeds come from
//! `hash(story, date_bucket)`, so a fork reproduces the original exactly.

pub mod churn;
pub mod duration;
pub mod report;
pub mod seed;
pub mod test_identity;

pub use report::{render, Outcome, ReportSpec, SuiteSpec, TestCaseSpec};
pub use seed::{stable_hash, DateBucket, StoryRng};
pub use test_identity::TestIdentity;

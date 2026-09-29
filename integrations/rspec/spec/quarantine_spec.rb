# frozen_string_literal: true

# Once a rung is quarantined the plugin swallows its failure in-process and rspec exits zero,
# with no uploader in between. Rates are constants here, so the names cannot lie.
RSpec.describe 'rspec quarantine' do
  [10, 30, 50].each do |rate|
    it "fails #{rate} percent of runs" do
      expect(Seeded.percentage("rspec-rate-#{rate}")).to be >= rate, "fails #{rate}% of runs — the demo working"
    end
  end
end

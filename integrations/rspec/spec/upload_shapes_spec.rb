# frozen_string_literal: true

# One example per status the plugin reports. See ../README.md.
RSpec.describe 'rspec upload shapes' do
  it 'passes' do
    expect(1 + 1).to eq(2)
  end

  it 'fails on characters that have to survive escaping' do
    payload = %(<tag attr="v"> & 'quoted' ünïcode → 😀)
    expect(payload).to eq('plain'), "payload was #{payload} — a deliberate failure"
  end

  it 'is skipped', skip: 'demonstrates a skipped result' do
    expect(1).to eq(2)
  end

  it 'is pending and still failing' do
    pending 'demonstrates a pending example reporting as a pass'
    expect(1).to eq(2)
  end
end

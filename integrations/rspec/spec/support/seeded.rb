# frozen_string_literal: true

# monitors/utils/random.ts, bit for bit: FNV-1a into mulberry32, keyed on the story and the
# UTC hour. Every step is masked to 32 bits because Ruby integers do not wrap the way JS's do.
module Seeded
  MASK = 0xFFFFFFFF

  module_function

  def imul(left, right)
    (left * right) & MASK
  end

  def stable_hash(input)
    input.encode('UTF-16LE').unpack('v*').reduce(0x811c9dc5) { |hash, unit| imul(hash ^ unit, 0x01000193) }
  end

  def seeded_random(seed)
    state = (seed + 0x6d2b79f5) & MASK
    state = imul(state ^ (state >> 15), state | 1)
    state ^= (state + imul(state ^ (state >> 7), state | 61)) & MASK
    (state ^ (state >> 14)) / 4_294_967_296.0
  end

  def percentage(key, bucket = Time.now.utc.strftime('%Y-%m-%dT%H'))
    seeded_random(stable_hash("#{key}##{bucket}")) * 100
  end
end

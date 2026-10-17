let calculateSmoothedElevation;
beforeAll(async () => {
    ({ calculateSmoothedElevation } = await import('../utils.js'));
});

test.each([0.1, 0.2, 0.5])('preserves a 200 m gradual climb sampled at %s m', step => {
    const data = Array.from({ length: Math.round(200 / step) + 1 }, (_, i) => [i, 100 + i * step]);
    const { gain, loss } = calculateSmoothedElevation(data);
    // Endpoint smoothing and the unfinished threshold can remove at most 2 m.
    expect(gain).toBeGreaterThanOrEqual(198);
    expect(gain).toBeLessThanOrEqual(200);
    expect(loss).toBe(0);
});

test('preserves a gradual ascent followed by a gradual descent', () => {
    const climb = Array.from({ length: 1001 }, (_, i) => [i, 100 + i / 5]);
    const descent = Array.from({ length: 1000 }, (_, i) => [1001 + i, 300 - (i + 1) / 5]);
    const { gain, loss } = calculateSmoothedElevation([...climb, ...descent]);
    expect(gain).toBeGreaterThan(198);
    expect(loss).toBeGreaterThan(198);
    expect(gain).toBeLessThanOrEqual(200);
    expect(loss).toBeLessThanOrEqual(200);
});

test('still ignores bounded noise on a flat track', () => {
    const data = Array.from({ length: 1000 }, (_, i) => [i, 100 + (i % 2 ? 0.2 : -0.2)]);
    expect(calculateSmoothedElevation(data)).toEqual({ gain: 0, loss: 0 });
});

// Unit tests run in two forked workers: steady memory on small machines and in CI.
export default { test: { pool: 'forks', maxWorkers: 2 } };

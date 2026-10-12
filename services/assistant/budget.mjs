import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Single process only. Reservations remain charged after crashes/unknown provider outcomes.
export class Budget {
  constructor(directory, allowanceMicros, now = () => new Date()) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.directory = directory;
    this.allowance = allowanceMicros;
    this.now = now;
    this.lock = join(directory, 'process.lock');
    const fd = openSync(this.lock, 'wx', 0o600);
    writeFileSync(fd, String(process.pid)); closeSync(fd);
    try {
      this.state = JSON.parse(readFileSync(join(directory, 'budget.json'), 'utf8'));
      if (!/^\d{4}-\d{2}$/.test(this.state.month) || !Number.isSafeInteger(this.state.charged) || this.state.charged < 0) throw Error('Invalid budget');
    } catch (error) {
      if (error.code !== 'ENOENT') { this.close(); throw error; }
      this.state = { month: this.month(), charged: 0 };
    }
  }
  month() { return this.now().toISOString().slice(0, 7); }
  save() {
    const path = join(this.directory, 'budget.json');
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.state), { mode: 0o600 });
    const fd = openSync(temporary, 'r'); fsyncSync(fd); closeSync(fd);
    renameSync(temporary, path);
    const dir = openSync(this.directory, 'r'); fsyncSync(dir); closeSync(dir);
  }
  reserve(amount) {
    if (this.broken) throw Object.assign(Error('Budget unavailable'), { code: 'budget_unavailable' });
    if (this.state.month !== this.month()) this.state = { month: this.month(), charged: 0 };
    if (this.state.charged + amount > this.allowance) throw Object.assign(Error('Budget exhausted'), { code: 'budget_exhausted' });
    this.state.charged += amount;
    try { this.save(); } catch (error) { this.broken = true; throw Object.assign(error, { code: 'budget_unavailable' }); }
    const month = this.state.month;
    let finished = false;
    return actual => {
      if (finished) return;
      finished = true;
      if (!Number.isSafeInteger(actual) || actual < 0) throw Error('Invalid usage charge');
      if (this.state.month === month) {
        this.state.charged -= amount - actual;
        try { this.save(); } catch (error) { this.broken = true; throw error; }
      }
    };
  }
  close() { rmSync(this.lock, { force: true }); }
}

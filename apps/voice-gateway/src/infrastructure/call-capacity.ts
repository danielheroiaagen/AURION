/**
 * Cost guard for paid traffic (ADR-034): a phone line wired to billed
 * providers needs hard ceilings BEFORE ads send strangers (or bots) to
 * it. Two caps, both checked at the TwiML front door so an over-limit
 * call is answered with a polite busy message and never reaches the
 * providers.
 */
export class CallCapacity {
  private active = 0;
  private today = 0;
  private day = '';

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxPerDay: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private rollover(): void {
    const date = this.now().toISOString().slice(0, 10);
    if (date !== this.day) {
      this.day = date;
      this.today = 0;
    }
  }

  hasRoom(): boolean {
    this.rollover();
    return this.active < this.maxConcurrent && this.today < this.maxPerDay;
  }

  begin(): void {
    this.rollover();
    this.active += 1;
    this.today += 1;
  }

  end(): void {
    this.active = Math.max(0, this.active - 1);
  }

  /** For logs and tests. */
  snapshot(): { active: number; today: number } {
    this.rollover();
    return { active: this.active, today: this.today };
  }
}

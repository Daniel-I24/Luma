/** What the audit log stores for one admin action (admin_recent_audit). */
export interface AuditLine {
  readonly action: string;
  readonly detail: string | null;
}

/** Actions the database audits (admin_audit_log_action_valid). */
const ACTIONS = new Set(['review_business', 'void_payment', 'mark_refund_done', 'clear_strikes', 'reconcile_payments', 'verify_contact']);
/** How each action's detail is said: a review decision, or the kind of contact. */
const DETAILS: Readonly<Record<string, { readonly prefix: string; readonly values: ReadonlySet<string> }>> = {
  review_business: { prefix: 'admin.operations.decisions', values: new Set(['approved', 'rejected', 'suspended']) },
  verify_contact: { prefix: 'contactVerification.kind', values: new Set(['phone', 'whatsapp', 'instagram', 'facebook', 'website']) },
};

/**
 * AuditText — the translation keys of a line of "Registro reciente". Never a
 * raw action or status: an unknown action reads "Otra acción" and an unknown
 * detail is left out.
 */
export class AuditText {
  /** The words of the action; "Otra acción del equipo" for one the app does not know. */
  public static actionKey(line: AuditLine): string {
    return `admin.operations.actions.${ACTIONS.has(line.action) ? line.action : 'other'}`;
  }

  /** Null when the action has no detail worth saying, or it is not a known one. */
  public static detailKey(line: AuditLine): string | null {
    const known = DETAILS[line.action];
    return known && line.detail && known.values.has(line.detail) ? `${known.prefix}.${line.detail}` : null;
  }
}

export function isSequenceId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.trim().length > 0;
}

export type SequenceLike = {
  id: string;
  prefix_id?: string;
  attributes?: {
    name?: string;
    prefix_id?: string;
    id?: string;
  };
};

export function getSequenceId(sequence: SequenceLike): string | null {
  const candidates = [
    sequence.id,
    sequence.attributes?.id,
    sequence.prefix_id,
    sequence.attributes?.prefix_id,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && isSequenceId(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

type GetSequences = () => Promise<SequenceLike[] | null | undefined>;

type ResolveSequenceIdInput = {
  sequenceId?: string;
  sequenceName?: string;
  getSequences: GetSequences;
};

function normalizeName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export type ResolveSequenceIdResult =
  | { ok: true; sequenceId: string }
  | {
      ok: false;
      reason: "missing_input" | "not_found" | "missing_id";
      sequenceName?: string;
    };

export async function resolveSequenceId({
  sequenceId,
  sequenceName,
  getSequences,
}: ResolveSequenceIdInput): Promise<ResolveSequenceIdResult> {
  const normalizedSequenceId = sequenceId?.trim();
  if (normalizedSequenceId) {
    return { ok: true, sequenceId: normalizedSequenceId };
  }

  const normalizedSequenceName = normalizeName(sequenceName);
  if (!normalizedSequenceName) {
    return { ok: false, reason: "missing_input" };
  }

  const sequences = await getSequences();
  if (!sequences || sequences.length === 0) {
    return { ok: false, reason: "not_found", sequenceName: normalizedSequenceName };
  }

  const match = sequences.find(
    (sequence) => normalizeName(sequence.attributes?.name) === normalizedSequenceName
  );

  if (!match) {
    return { ok: false, reason: "not_found", sequenceName: normalizedSequenceName };
  }

  const id = getSequenceId(match);
  if (!id) {
    return { ok: false, reason: "missing_id", sequenceName: normalizedSequenceName };
  }

  return { ok: true, sequenceId: id };
}

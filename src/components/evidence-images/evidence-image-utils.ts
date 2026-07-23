export const EVIDENCE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;

export const EVIDENCE_IMAGE_ACCEPT_ATTRIBUTE = Object.keys(
  EVIDENCE_IMAGE_ACCEPT,
).join(",");

export type EvidenceImageRejectionReason = "size" | "type";

export type EvidenceImageValidationResult = {
  accepted: File[];
  rejected: Array<{
    file: File;
    reason: EvidenceImageRejectionReason;
  }>;
};

const acceptedTypes = new Set<string>(Object.keys(EVIDENCE_IMAGE_ACCEPT));

export function validateEvidenceImageFiles(
  files: Iterable<File>,
): EvidenceImageValidationResult {
  const accepted: File[] = [];
  const rejected: EvidenceImageValidationResult["rejected"] = [];

  for (const file of files) {
    if (!acceptedTypes.has(file.type)) {
      rejected.push({ file, reason: "type" });
      continue;
    }

    if (file.size > EVIDENCE_IMAGE_MAX_BYTES) {
      rejected.push({ file, reason: "size" });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}

export function appendIndexedEvidenceImages(
  formData: FormData,
  itemImages: ReadonlyArray<ReadonlyArray<File>> | undefined,
) {
  itemImages?.forEach((files, index) => {
    files.forEach((file) => formData.append(`images_${index}`, file));
  });
}

export function appendEvidenceImages(
  formData: FormData,
  files: ReadonlyArray<File> | undefined,
  fieldName = "images",
) {
  files?.forEach((file) => formData.append(fieldName, file));
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function materializeReferenceUrl(url: string) {
  if (!url.startsWith("blob:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const blob = await response.blob();
  return fileToDataUrl(new File([blob], "reference", { type: blob.type || "image/png" }));
}

export async function appendImageFromUrl(form: FormData, field: string, url: string, name: string, mode: "set" | "append" = "set") {
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const blob = await response.blob();
  const filename = name.replace(/[^\w.-]+/g, "-") || `${field}.png`;
  if (mode === "append") form.append(field, blob, filename);
  else form.set(field, blob, filename);
}

export async function localUrlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const blob = await response.blob();
  return fileToDataUrl(new File([blob], "agent-reference", { type: blob.type || "image/png" }));
}

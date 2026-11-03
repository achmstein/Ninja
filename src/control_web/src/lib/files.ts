/** A picked file's text: a key file, a .p8 */
export function readFileText(file: File): Promise<string> {
  return file.text()
}

/** A picked file as base64, without the data: prefix: a keystore, an icon */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

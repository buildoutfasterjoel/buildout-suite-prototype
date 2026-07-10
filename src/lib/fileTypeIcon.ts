import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faFileLines,
  faFilePdf,
  faFileWord,
  faFileExcel,
  faFileCsv,
  faFilePowerpoint,
  faFileImage,
  faFileZipper,
} from '@fortawesome/pro-regular-svg-icons'

const ICONS_BY_EXTENSION: Record<string, IconDefinition> = {
  pdf: faFilePdf,
  doc: faFileWord,
  docx: faFileWord,
  xls: faFileExcel,
  xlsx: faFileExcel,
  csv: faFileCsv,
  ppt: faFilePowerpoint,
  pptx: faFilePowerpoint,
  jpg: faFileImage,
  jpeg: faFileImage,
  png: faFileImage,
  gif: faFileImage,
  webp: faFileImage,
  svg: faFileImage,
  zip: faFileZipper,
  rar: faFileZipper,
  '7z': faFileZipper,
}

/** Picks a FontAwesome icon for a file based on its name's extension, falling back to a generic file icon. */
export function fileTypeIcon(name: string): IconDefinition {
  const extension = name.split('.').pop()?.toLowerCase()
  return (extension && ICONS_BY_EXTENSION[extension]) || faFileLines
}

import { Download } from 'lucide-react'
import { Button, CopyButton, Label, Textarea } from 'kern'
import type { OutputFile } from '@/engine/types'

function download(file: OutputFile) {
  const type = file.name.endsWith('.css') ? 'text/css' : 'application/json'
  const url = URL.createObjectURL(new Blob([file.text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

/** One panel per output file. Figma takes one file per mode, so a two-mode set is two panels. */
export function OutputFiles({ files }: { files: OutputFile[] }) {
  return (
    <div className="flex flex-col gap-4">
      {files.map((file) => (
        <div key={file.name} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label as="span" className="font-mono">
              {file.name}
            </Label>
            <div className="flex items-center gap-1">
              <CopyButton text={file.text} />
              <Button size="sm" variant="ghost" onClick={() => download(file)}>
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            </div>
          </div>
          <Textarea
            value={file.text}
            readOnly
            rows={14}
            spellCheck={false}
            className="font-mono"
            aria-label={`${file.name} output`}
          />
        </div>
      ))}
    </div>
  )
}

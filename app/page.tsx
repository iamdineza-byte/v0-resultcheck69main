"use client"

import ResultsChecker from "@/components/ResultsChecker"

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <ResultsChecker />
      </div>

      <footer className="bg-muted/30 border-t mt-8 py-4 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground font-sans">
            ⚠️ <span className="font-medium">Important Disclaimer:</span> This is not an official results checking
            website.
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            For takedown contact:{" "}
            <a href="mailto:leedidier030@gmail.com" className="text-primary hover:underline">
              leedidier030@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

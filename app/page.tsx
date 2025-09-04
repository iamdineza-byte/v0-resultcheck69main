"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function Page() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Rwanda Education Results Portal</h1>
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>How to check your results</AccordionTrigger>
          <AccordionContent>
            Enter your student ID and select your examination type to view your results.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

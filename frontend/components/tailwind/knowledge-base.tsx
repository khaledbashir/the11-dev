"use client";

export function KnowledgeBase() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <iframe
          src="https://ahmad-anything-llm.840tjq.easypanel.host/embed/dee07d93-59b9-4cb9-ba82-953cf79953a2"
          className="w-full h-full border-0"
          title="AnythingLLM Knowledge Base"
          allow="microphone; camera"
        />
      </div>
    </div>
  );
}

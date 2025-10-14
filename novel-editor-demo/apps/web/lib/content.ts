export const defaultEditorContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Statement of Work (SOW)" }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Project Overview" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Provide a brief description of the project, including its purpose, goals, and expected outcomes." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Scope of Work" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Detail the specific tasks, deliverables, and responsibilities involved in this project." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Deliverables" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Deliverable 1: Description" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Deliverable 2: Description" }],
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Timeline" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Outline the project timeline, including key milestones and deadlines." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Budget" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Specify the estimated costs and payment terms." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Terms and Conditions" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Include any relevant terms, conditions, and agreements." },
      ],
    },
  ],
};
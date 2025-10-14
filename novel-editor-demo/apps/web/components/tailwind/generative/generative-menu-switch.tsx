import { EditorBubble, useEditor } from "novel";
import { removeAIHighlight } from "novel/extensions";
import { Fragment, type ReactNode, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import Magic from "../ui/icons/magic";
import { AISelector } from "./ai-selector";

interface GenerativeMenuSwitchProps {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GenerativeMenuSwitch = ({ children, open, onOpenChange }: GenerativeMenuSwitchProps) => {
  const { editor } = useEditor();
  const preventCloseRef = useRef(false);

  useEffect(() => {
    console.log("🔍 [ASK AI POPUP] State changed - open:", open);
    if (!open) {
      removeAIHighlight(editor);
      preventCloseRef.current = false;
    } else {
      // When popup opens, prevent it from closing for 3 seconds
      preventCloseRef.current = true;
      setTimeout(() => {
        console.log("⏰ [ASK AI POPUP] Auto-prevent timeout - allow manual close now");
        preventCloseRef.current = false;
      }, 3000);
    }
  }, [open, editor]);

  const handleOpenChange = (newOpen: boolean) => {
    console.log("🎯 [ASK AI POPUP] Open change requested - from:", open, "to:", newOpen);
    onOpenChange(newOpen);
  };

  return (
    <EditorBubble
      tippyOptions={{
        placement: open ? "bottom-start" : "top",
        
        // CRITICAL: Prevent hiding when interacting
        hideOnClick: false,
        interactive: true,
        appendTo: () => document.body,
        
        // VERY long delay before hiding
        delay: [200, 3000], // Wait 3 seconds before hiding
        
        // HUGE interaction area
        interactiveBorder: 100,
        
        // Manual control
        trigger: 'manual mouseenter focus',
        
        // Duration
        duration: [300, 1000],
        
        // Better positioning
        popperOptions: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: {
                padding: 12,
                altAxis: true,
                tether: false,
              },
            },
          ],
        },
        
        // EXTENSIVE LOGGING
        onCreate: () => {
          console.log("✨ [ASK AI POPUP] Created");
        },
        
        onShow: () => {
          console.log("👁️ [ASK AI POPUP] Showing");
        },
        
        onMount: () => {
          console.log("📌 [ASK AI POPUP] Mounted to DOM");
        },
        
        onHide: () => {
          const shouldPrevent = open || preventCloseRef.current;
          console.log("🙈 [ASK AI POPUP] Hide attempt - open:", open, "preventClose:", preventCloseRef.current, "→", shouldPrevent ? "BLOCKED" : "ALLOWED");
          
          if (shouldPrevent) {
            console.log("🚫 [ASK AI POPUP] ===== HIDE PREVENTED =====");
            return false; // Block hide
          }
          
          console.log("✅ [ASK AI POPUP] Hide allowed");
        },
        
        onHidden: () => {
          console.log("🔒 [ASK AI POPUP] Fully hidden");
          if (!open) {
            editor?.chain().unsetHighlight().run();
          }
        },
      }}
      className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
    >
      {open && (
        <div 
          onMouseDown={(e) => {
            console.log("🖱️ [AI SELECTOR] Mouse down");
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            console.log("🖱️ [AI SELECTOR] Clicked");
            e.stopPropagation();
          }}
        >
          <AISelector open={open} onOpenChange={handleOpenChange} />
        </div>
      )}
      {!open && (
        <Fragment>
          <Button
            className="gap-1 rounded-none text-purple-500"
            variant="ghost"
            onClick={(e) => {
              console.log("🎨 [ASK AI BUTTON] Clicked!");
              e.preventDefault();
              e.stopPropagation();
              handleOpenChange(true);
            }}
            onMouseDown={(e) => {
              console.log("🎨 [ASK AI BUTTON] Mouse down");
              e.preventDefault();
              e.stopPropagation();
            }}
            size="sm"
          >
            <Magic className="h-5 w-5" />
            Ask AI
          </Button>
          {children}
        </Fragment>
      )}
    </EditorBubble>
  );
};

export default GenerativeMenuSwitch;

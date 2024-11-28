import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogProps } from "@radix-ui/react-dialog";
import { FC, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { RestakeDialog } from "./RestakeDialog";
import { useToggle } from "@uidotdev/usehooks";
import { useQuery } from "@tanstack/react-query";
import { fetchPointNegations } from "@/actions/fetchPointNegations";
import { PointStats } from "./PointStats";
import { favor } from "@/lib/negation-game/favor";
import { Loader } from "./ui/loader";
import { NegationResult } from "@/actions/fetchPointNegations";

interface SelectNegationDialogProps extends DialogProps {
  originalPoint: {
    id: number;
    content: string;
    createdAt: Date;
    stakedAmount: number;
  };
  negationId: number;
}

export const SelectNegationDialog: FC<SelectNegationDialogProps> = ({
  originalPoint,
  negationId,
  open,
  onOpenChange,
  ...props
}) => {
  const [selectedNegation, setSelectedNegation] = useState<NegationResult | null>(null);
  const [restakeDialogOpen, toggleRestakeDialog] = useToggle(false);

  const { data: negations, isLoading } = useQuery({
    queryKey: ["point-negations", originalPoint.id],
    queryFn: () => fetchPointNegations(originalPoint.id),
    enabled: open,
  });

  return (
    <>
      <Dialog {...props} open={open && !restakeDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex flex-col gap-6 p-4 sm:p-6 max-w-xl">
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-primary">
                <ArrowLeftIcon className="size-5" />
              </Button>
            </DialogClose>
            <DialogTitle>Select a negation to restake</DialogTitle>
          </div>

          {isLoading ? (
            <Loader className="self-center" />
          ) : (
            <div className="space-y-3">
              {negations?.map((negation: NegationResult) => (
                <div
                  key={negation.id}
                  className="flex flex-col p-4 border rounded-md cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setSelectedNegation(negation);
                    toggleRestakeDialog(true);
                  }}
                >
                  <p className="mb-2">{negation.content}</p>
                  <PointStats
                    favor={favor(negation)}
                    amountNegations={negation.amountNegations}
                    amountSupporters={negation.amountSupporters}
                    cred={negation.cred}
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedNegation && (
        <RestakeDialog
          open={restakeDialogOpen}
          onOpenChange={(isOpen) => {
            toggleRestakeDialog(isOpen);
            if (!isOpen) {
              onOpenChange?.(false);
              setSelectedNegation(null);
            }
          }}
          originalPoint={originalPoint}
          counterPoint={selectedNegation}
        />
      )}
    </>
  );
}; 
import { endorse } from "@/actions/endorse";
import { fetchSimilarPoints } from "@/actions/fetchSimilarPoints";
import { makePoint } from "@/actions/makePoint";
import { CredInput } from "@/components/CredInput";
import { PointEditor } from "@/components/PointEditor";
import { PointStats } from "@/components/PointStats";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { POINT_MAX_LENGHT, POINT_MIN_LENGHT } from "@/constants/config";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/cn";
import { favor } from "@/lib/negation-game/favor";
import { DialogProps } from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { ArrowLeftIcon, BlendIcon, DiscIcon, Undo2Icon } from "lucide-react";
import { FC, useState } from "react";
import { IterableElement } from "type-fest";

export interface MakePointDialogProps extends DialogProps {}

export const MakePointDialog: FC<MakePointDialogProps> = ({
  onOpenChange,
  ...props
}) => {
  const [content, setContent] = useState("");
  const [cred, setCred] = useState<number>(0);
  const [selectedPoint, selectPoint] = useState<
    IterableElement<typeof similarPoints> | undefined
  >(undefined);
  const charactersLeft = POINT_MAX_LENGHT - content.length;
  const { data: user } = useUser();
  const canSubmit =
    user &&
    user.cred >= cred &&
    cred > 0 &&
    (selectedPoint ||
      (charactersLeft >= 0 && content.length >= POINT_MIN_LENGHT));
  const queryClient = useQueryClient();
  const debouncedContent = useDebounce(content, 500);
  const { data: similarPoints } = useQuery({
    queryKey: ["similarPoints", debouncedContent],
    queryFn: ({ queryKey: [, query] }) =>
      debouncedContent.length >= POINT_MIN_LENGHT
        ? fetchSimilarPoints({ query })
        : [],
  });

  return (
    <Dialog {...props} onOpenChange={onOpenChange}>
      <DialogContent className="sm:top-xl flex flex-col overflow-auto sm:translate-y-0 h-full rounded-none sm:rounded-md sm:h-fit gap-0  bg-background p-4 sm:p-8 shadow-sm w-full max-w-xl">
        <div className="w-full flex items-center justify-between mb-xl">
          <DialogTitle hidden>Make a Point</DialogTitle>
          <DialogDescription hidden>
            Create a new Point and endorse it with some cred
          </DialogDescription>
          <DialogClose className="text-primary">
            <ArrowLeftIcon />
          </DialogClose>
        </div>

        <div className="flex w-full gap-3 mb-lg">
          <div className="flex flex-col items-center">
            <DiscIcon
              className={cn(
                "size-6 text-muted-foreground stroke-1",
                !selectedPoint && "text-endorsed"
              )}
            />
            {cred > 0 && (
              <span className="relative text-endorsed text-xs">
                <span className="absolute -left-2">+</span>
                {cred}
              </span>
            )}
          </div>

          {selectedPoint ? (
            <div className="flex flex-col">
              <div className="flex flex-col p-4 gap-2 w-full border rounded-md mb-2">
                <span className="flex-grow text-sm">
                  {selectedPoint.content}
                </span>
                <PointStats
                  favor={favor({
                    ...selectedPoint,
                  })}
                  amountNegations={selectedPoint.amountNegations}
                  amountSupporters={selectedPoint.amountSupporters}
                  cred={selectedPoint.cred}
                />
              </div>
              <div className="flex justify-between">
                <CredInput cred={cred} setCred={setCred} />
                <Button
                  variant={"link"}
                  size={"icon"}
                  onClick={() => selectPoint(undefined)}
                >
                  <Undo2Icon />
                </Button>
              </div>
            </div>
          ) : (
            <PointEditor
              className="w-full -mt-1"
              content={content}
              setContent={setContent}
              cred={cred}
              setCred={setCred}
              placeholder="Make your Point"
            />
          )}
        </div>

        {!selectedPoint && similarPoints && similarPoints.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-md">
              Make the most of your cred by endorsing an existing similar Point:
            </p>

            {similarPoints?.map((similarPoint) => (
              <div
                key={similarPoint.id}
                onClick={() => selectPoint(similarPoint)}
                className="flex p-4 gap-2 hover:bg-accent w-full cursor-pointer border rounded-md mb-2"
              >
                <BlendIcon className="size-5 shrink-0 text-muted-foreground stroke-1" />
                <div className="flex flex-col gap-2">
                  <span className="flex-grow text-sm">
                    {similarPoint.content}
                  </span>
                  <PointStats
                    favor={favor({
                      ...similarPoint,
                    })}
                    amountNegations={similarPoint.amountNegations}
                    amountSupporters={similarPoint.amountSupporters}
                    cred={similarPoint.cred}
                  />
                </div>
              </div>
            ))}
          </>
        )}
        <Button
          className="self-end mt-md"
          disabled={!canSubmit}
          onClick={() => {
            (selectedPoint
              ? endorse({ pointId: selectedPoint.id, cred })
              : makePoint({
                  content,
                  cred: cred,
                })
            ).then(() => {
              queryClient.invalidateQueries({
                queryKey: ["feed"],
                exact: false,
              });
              onOpenChange?.(false);
              setContent("");
              selectPoint(undefined);
              setCred(0);
            });
          }}
        >
          {selectedPoint ? "Endorse Point" : "Make Point"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

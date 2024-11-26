import { addCounterpoint as addCounterpointAction } from "@/actions/addCounterpoint";
import { endorse as endorseAction } from "@/actions/endorse";
import { findCounterpointCandidatesAction as fetchCounterpointCandidatesAction } from "@/actions/findCounterpointCandidatesAction";
import { negate as negateAction } from "@/actions/negate";
import { reviewProposedCounterpointAction } from "@/actions/reviewProposedCounterpointAction";
import { negationContentAtom } from "@/atoms/negationContentAtom";
import { CredInput } from "@/components/CredInput";
import { PointEditor } from "@/components/PointEditor";
import { PointStats } from "@/components/PointStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GOOD_ENOUGH_POINT_RATING,
  POINT_MAX_LENGHT,
  POINT_MIN_LENGHT,
} from "@/constants/config";
import { useCredInput } from "@/hooks/useCredInput";
import { cn } from "@/lib/cn";
import { favor } from "@/lib/negation-game/favor";
import { DialogProps } from "@radix-ui/react-dialog";
import { PopoverAnchor } from "@radix-ui/react-popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToggle } from "@uidotdev/usehooks";
import { produce } from "immer";
import { useAtom } from "jotai";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CircleXIcon,
  DiscIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import { FC, useEffect, useState } from "react";

export interface NegateDialogProps extends DialogProps {
  negatedPoint?: { id: number; content: string; cred: number; createdAt: Date };
}

export const NegateDialog: FC<NegateDialogProps> = ({
  negatedPoint,
  open,
  onOpenChange,
  ...props
}) => {
  const [counterpointContent, setCounterpointContent] =
    useAtom(negationContentAtom);
  const [reviewPopoverOpen, toggleReviewPopoverOpen] = useToggle(false);
  const { cred, setCred, notEnoughCred, resetCred } = useCredInput({
    resetWhen: !open,
  });
  const { mutateAsync: addCounterpoint, isPending: isAddingCounterpoint } =
    useMutation({
      mutationFn: addCounterpointAction,
    });
  const { mutateAsync: negate, isPending: isNegating } = useMutation({
    mutationFn: negateAction,
  });
  const { mutateAsync: endorse, isPending: isEndorsing } = useMutation({
    mutationFn: endorseAction,
  });

  const isSubmitting = isNegating || isEndorsing || isAddingCounterpoint;

  const [selectedCounterpointCandidate, selectCounterpointCandidate] = useState<
    | Awaited<ReturnType<typeof fetchCounterpointCandidatesAction>>[number]
    | undefined
  >(undefined);
  const charactersLeft = POINT_MAX_LENGHT - counterpointContent.length;

  const queryClient = useQueryClient();

  const {
    data: reviewResults,
    isLoading: isReviewingCounterpoint,
    isSuccess: counterpointWasReviewed,
    isStale: reviewIsStale,
    refetch: reviewCounterpoint,
    status,
  } = useQuery({
    enabled: false,
    staleTime: 60_000,
    queryKey: [
      "counterpoint-review",
      negatedPoint,
      counterpointContent,
    ] as const,
    queryFn: async ({ queryKey: [, negatedPoint, counterpointContent] }) => {
      const reviewResults = await reviewProposedCounterpointAction({
        negatedPointId: negatedPoint!.id,
        negatedPointContent: negatedPoint!.content,
        counterpointContent,
      });

      //set the review results cache for rephrasings so that the user is not forced to review again right away if he picks one
      reviewResults.rephrasings.forEach((selectedRephrasing) =>
        queryClient.setQueryData<typeof reviewResults>(
          ["counterpoint-review", negatedPoint, selectedRephrasing] as const,
          produce(reviewResults, (draft) => {
            draft.rating = 10;
            draft.rephrasings = draft.rephrasings.filter(
              (suggestedRephrasing) =>
                suggestedRephrasing !== selectedRephrasing
            );
          })
        )
      );

      if (
        reviewResults.existingSimilarCounterpoints.length > 0 ||
        reviewResults.rating < GOOD_ENOUGH_POINT_RATING
      )
        toggleReviewPopoverOpen(true);

      return reviewResults;
    },
  });

  const canReview =
    charactersLeft >= 0 && counterpointContent.length >= POINT_MIN_LENGHT;

  const canSubmit = selectedCounterpointCandidate
    ? cred > 0
    : charactersLeft >= 0 &&
      counterpointContent.length >= POINT_MIN_LENGHT &&
      cred > 0;

  useEffect(() => {
    if (!open) {
      setCounterpointContent("");
      selectCounterpointCandidate(undefined);
    }
  }, [open, setCounterpointContent]);

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container sm:top-xl flex flex-col overflow-auto sm:translate-y-0 h-full rounded-none sm:rounded-md sm:h-fit gap-0  bg-background  p-4 sm:p-8 shadow-sm w-full max-w-xl">
        <div className="w-full flex items-center justify-between mb-xl">
          <DialogTitle>Negate</DialogTitle>
          <DialogDescription hidden>
            Add a negation to the Point
          </DialogDescription>
          <DialogClose className="text-primary">
            <ArrowLeftIcon />
          </DialogClose>
        </div>
        <Popover
          modal
          open={reviewPopoverOpen}
          onOpenChange={toggleReviewPopoverOpen}
        >
          <PopoverAnchor>
            <div className="flex w-full gap-md">
              <div className="flex flex-col  items-center">
                <DiscIcon className="shrink-0 size-6 stroke-1 text-muted-foreground " />
                <div
                  className={cn(
                    "w-px -my-px flex-grow border-l border-muted-foreground",
                    (!selectedCounterpointCandidate ||
                      !selectedCounterpointCandidate.isCounterpoint) &&
                      "border-dashed border-endorsed"
                  )}
                />
              </div>
              <div className="@container/point flex-grow flex flex-col mb-md pt-1">
                <p className="tracking-tight text-md  @sm/point:text-lg mb-lg -mt-2">
                  {negatedPoint?.content}
                </p>
              </div>
            </div>
          </PopoverAnchor>

          <div className="flex w-full gap-md mb-lg">
            <div className="flex flex-col  items-center">
              <CircleXIcon
                className={cn(
                  "shrink-0 size-6 stroke-1 text-muted-foreground",
                  !selectedCounterpointCandidate &&
                    "circle-dashed-2 text-endorsed"
                )}
              />
              {cred > 0 && (
                <span className="relative text-endorsed text-xs">
                  <span className="absolute -left-2">+</span>
                  {cred}
                </span>
              )}
            </div>

            {selectedCounterpointCandidate ? (
              <div className="flex flex-col items-start w-full">
                <div className="relative flex flex-col p-4 gap-2 w-full border rounded-md mb-2">
                  <Button
                    className="absolute -right-2 -bottom-4 text-muted-foreground border rounded-full  p-2 size-fit "
                    variant={"outline"}
                    size={"icon"}
                    onClick={() => selectCounterpointCandidate(undefined)}
                  >
                    <TrashIcon className=" size-5" />
                  </Button>
                  <span className="flex-grow text-sm">
                    {selectedCounterpointCandidate.content}
                  </span>
                  <PointStats
                    favor={favor({
                      ...selectedCounterpointCandidate,
                    })}
                    amountNegations={
                      selectedCounterpointCandidate.amountNegations
                    }
                    amountSupporters={
                      selectedCounterpointCandidate.amountSupporters
                    }
                    cred={selectedCounterpointCandidate.cred}
                  />
                </div>

                <CredInput
                  cred={cred}
                  setCred={setCred}
                  notEnoughCred={notEnoughCred}
                />
              </div>
            ) : (
              <PointEditor
                className="w-full -mt-1"
                content={counterpointContent}
                setContent={setCounterpointContent}
                cred={cred}
                setCred={setCred}
                placeholder="Make your counterpoint"
              />
            )}
          </div>

          {counterpointWasReviewed && !reviewIsStale ? (
            <div className="self-end mt-md flex gap-2">
              <Button
                variant="outline"
                className={"min-w-28"}
                rightLoading={
                  isReviewingCounterpoint ||
                  isNegating ||
                  isEndorsing ||
                  isAddingCounterpoint
                }
                disabled={!canSubmit || isSubmitting}
                onClick={() =>
                  (selectedCounterpointCandidate === undefined
                    ? addCounterpoint({
                        content: counterpointContent,
                        cred,
                        olderPointId: negatedPoint?.id,
                      })
                    : selectedCounterpointCandidate.isCounterpoint
                      ? endorse({
                          pointId: selectedCounterpointCandidate.id,
                          cred,
                        })
                      : negate({
                          negatedPointId: negatedPoint!.id,
                          counterpointId: selectedCounterpointCandidate.id,
                          cred,
                        })
                  ).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["feed"] });
                    queryClient.invalidateQueries({
                      queryKey: ["point-negations", negatedPoint?.id],
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["favor-history", negatedPoint?.id],
                    });

                    onOpenChange?.(false);
                    setCounterpointContent("");
                    resetCred();
                  })
                }
              >
                {selectedCounterpointCandidate?.isCounterpoint
                  ? isSubmitting
                    ? "Endorsing"
                    : "Endorse"
                  : isSubmitting
                    ? "Negating"
                    : "Negate"}
              </Button>

              <PopoverTrigger asChild>
                <Button>
                  Review suggestions{" "}
                  <Badge className="bg-white text-primary ml-2 px-1.5">
                    {reviewResults.existingSimilarCounterpoints.length +
                      reviewResults.rephrasings.length}
                  </Badge>
                </Button>
              </PopoverTrigger>

              <PopoverContent
                autoFocus
                className="flex flex-col w-[var(--radix-popper-anchor-width)] max-h-[var(--radix-popper-available-height)] sm:max-h-96  pt-4 p-2 overflow-clip -mt-lg"
              >
                <p className="text-sm font-semibold text-muted-foreground mb-sm text-center">
                  Review suggestions
                </p>
                <div className="flex flex-col overflow-scroll  gap-sm shadow-inner border rounded-md p-2 bg-muted">
                  {reviewResults.existingSimilarCounterpoints.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground my-sm text-center">
                        Make the most of your cred by using an existing Point
                      </p>

                      {reviewResults.existingSimilarCounterpoints?.map(
                        (counterpointCandidate) => (
                          <div
                            key={counterpointCandidate.id}
                            className="flex flex-col gap-2 p-4  hover:border-muted-foreground  w-full bg-background cursor-pointer border rounded-md"
                            onClick={() => {
                              selectCounterpointCandidate(
                                counterpointCandidate
                              );
                              toggleReviewPopoverOpen(false);
                            }}
                          >
                            <span className="flex-grow text-sm">
                              {counterpointCandidate.content}
                            </span>
                            <PointStats
                              favor={favor({
                                ...counterpointCandidate,
                              })}
                              amountNegations={
                                counterpointCandidate.amountNegations
                              }
                              amountSupporters={
                                counterpointCandidate.amountSupporters
                              }
                              cred={counterpointCandidate.cred}
                            />
                          </div>
                        )
                      )}

                      <div className="flex items-center gap-2">
                        <div className="h-px border-b flex-grow" />{" "}
                        <span className="text-xs text-muted-foreground">
                          or
                        </span>
                        <div className="h-px border-b flex-grow" />
                      </div>
                    </>
                  )}

                  {reviewResults.rating >= GOOD_ENOUGH_POINT_RATING && (
                    <>
                      <span className="text-xs text-muted-foreground text-center">
                        Stick with your Point
                      </span>
                      <div
                        key={"player-counterpoint"}
                        onClick={() => {
                          selectCounterpointCandidate(undefined);
                          toggleReviewPopoverOpen(false);
                        }}
                        className="relative flex flex-col gap-2 p-4 w-full  bg-background   hover:border-muted-foreground cursor-pointer border border-dashed  rounded-md"
                      >
                        <span className="flex-grow text-sm">
                          {counterpointContent}
                        </span>
                        <PointStats
                          favor={favor({
                            cred,
                            negationsCred: negatedPoint?.cred ?? 0,
                          })}
                          amountNegations={1}
                          amountSupporters={1}
                          cred={cred}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-px border-b flex-grow" />{" "}
                        <span className="text-xs text-muted-foreground">
                          or
                        </span>
                        <div className="h-px border-b flex-grow" />
                      </div>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground text-center">
                    Pick one of the AI suggested rephrasings{" "}
                    <SparklesIcon className="size-3 inline-block" />
                  </span>
                  {reviewResults.rephrasings.map((rephrasing, i) => (
                    <div
                      key={`rephrasing-${i}`}
                      onClick={() => {
                        setCounterpointContent(rephrasing);
                        toggleReviewPopoverOpen(false);
                      }}
                      className="relative flex flex-col gap-2 p-4 w-full  bg-background   hover:border-muted-foreground cursor-pointer border border-dashed  rounded-md"
                    >
                      <span className="flex-grow text-sm">{rephrasing}</span>
                      <PointStats
                        favor={favor({
                          cred,
                          negationsCred: negatedPoint?.cred ?? 0,
                        })}
                        amountNegations={1}
                        amountSupporters={1}
                        cred={cred}
                      />
                    </div>
                  ))}
                  {reviewResults.rating < GOOD_ENOUGH_POINT_RATING && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-px border-b flex-grow" />{" "}
                        <span className="text-xs text-muted-foreground">
                          or
                        </span>
                        <div className="h-px border-b flex-grow" />
                      </div>
                      <span className="text-xs text-muted-foreground text-center">
                        Stick with your counterpoint
                      </span>
                      <div
                        key={"player-counterpoint"}
                        onClick={() => {
                          selectCounterpointCandidate(undefined);
                          toggleReviewPopoverOpen(false);
                        }}
                        className="relative flex flex-col gap-2 p-4 w-full  bg-background   hover:border-muted-foreground  cursor-pointer border border-dashed  rounded-md"
                      >
                        <span className="flex-grow text-sm">
                          {counterpointContent}
                        </span>
                        <PointStats
                          favor={favor({
                            cred,
                            negationsCred: negatedPoint?.cred ?? 0,
                          })}
                          amountNegations={1}
                          amountSupporters={1}
                          cred={cred}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground text-center">
                        <AlertTriangleIcon className="size-3 align-[-2px] inline-block mr-1" />
                        {reviewResults.suggestions}
                      </span>
                    </>
                  )}
                </div>
              </PopoverContent>
            </div>
          ) : (
            <Button
              disabled={!canReview || isReviewingCounterpoint}
              className="min-w-28 mt-md self-end"
              rightLoading={isReviewingCounterpoint}
              onClick={() => {
                reviewCounterpoint();
              }}
            >
              Review & Negate
            </Button>
          )}
        </Popover>
      </DialogContent>
    </Dialog>
  );
};

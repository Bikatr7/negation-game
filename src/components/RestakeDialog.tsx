import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DialogProps } from "@radix-ui/react-dialog";
import { FC, useState, useEffect, useCallback } from "react";
import { ArrowLeftIcon, AlertCircle, Check } from "lucide-react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchFavorHistory } from "@/actions/fetchFavorHistory";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_TIMESCALE } from "@/constants/config";
import { TimelineScale } from "@/lib/timelineScale";
import { Loader } from "./ui/loader";
import { cn } from "@/lib/cn";
import { endorse } from "@/actions/endorse";
import { CredInput } from "@/components/CredInput";
import { useCredInput } from "@/hooks/useCredInput";
import { useQueryClient } from "@tanstack/react-query";
import { useToggle } from "@uidotdev/usehooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { timelineScales } from "@/lib/timelineScale";
import { PointStats } from "@/components/PointStats";
import { favor } from "@/lib/negation-game/favor";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

export interface RestakeDialogProps extends DialogProps {
  originalPoint: {
    id: number;
    content: string;
    createdAt: Date;
    stakedAmount: number;
    viewerCred?: number;
    cred: number;
    negationsCred: number;
    amountSupporters: number;
    amountNegations: number;
  };
  counterPoint: {
    id: number;
    content: string;
    createdAt: Date;
  };
  onEndorseClick?: () => void;
}

export const RestakeDialog: FC<RestakeDialogProps> = ({
  originalPoint,
  counterPoint,
  open,
  onOpenChange,
  onEndorseClick,
  ...props
}) => {
  // Get existing restake amount from localStorage (in cred)
  const existingRestakeKey = `restake-${originalPoint.id}-${counterPoint.id}`;
  const existingStakedCred = Number(localStorage.getItem(existingRestakeKey)) || 0;
  
  const maxStakeAmount = Math.floor(originalPoint.viewerCred || 0);

  const [stakedCred, setStakedCred] = useState(existingStakedCred);
  const [isSlashing, setIsSlashing] = useState(false);
  const [timelineScale, setTimelineScale] = useState<TimelineScale>(DEFAULT_TIMESCALE);
  const [endorsePopoverOpen, toggleEndorsePopoverOpen] = useToggle(false);
  const { cred, setCred, notEnoughCred } = useCredInput({
    resetWhen: !endorsePopoverOpen,
  });
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<{
    slashAmount: number;
    stakeAmount: number;
    currentlyStaked: number;
    maxStakeAmount: number;
    stakePercentage: number;
    bonusFavor: number;
    isSlashing: boolean;
  } | null>(null);

  const { data: favorHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["favor-history", originalPoint.id, timelineScale],
    queryFn: () => fetchFavorHistory({ 
      pointId: originalPoint.id, 
      scale: timelineScale 
    }),
    enabled: open,
  });

  const currentlyStaked = existingStakedCred;
  const newStakeAmount = stakedCred;

  const slashAmount = isSlashing ? Math.floor(currentlyStaked - newStakeAmount) : 0;
  const stakeAmount = isSlashing ? 0 : Math.floor(newStakeAmount);
  
  const bonusFavor = Math.floor(isSlashing ? slashAmount : stakeAmount);

  // Get the current favor from the last data point
  const currentFavor = favorHistory?.length ? favorHistory[favorHistory.length - 1].favor : 50;
  
  const handleSliderChange = useCallback((values: number[]) => {
    const newStakedCred = Math.floor(values[0]);
    setStakedCred(newStakedCred);
    setIsSlashing(newStakedCred < existingStakedCred);
  }, [existingStakedCred]);

  const projectedData = favorHistory ? [
    ...favorHistory,
    {
      timestamp: new Date(Date.now() + 8000),
      favor: currentFavor + (isSlashing ? -bonusFavor : bonusFavor),
      isProjection: true
    }
  ] : [];

  // Reset states when dialog closes
  useEffect(() => {
    if (!open) {
      setStakedCred(existingStakedCred);
      setShowSuccess(false);
      setIsSlashing(false);
    }
  }, [open, existingStakedCred]);

  const handleSubmit = () => {
    const restakeKey = `restake-${originalPoint.id}-${counterPoint.id}`;
    localStorage.setItem(restakeKey, newStakeAmount.toString());
    
    setSubmittedValues({
      slashAmount,
      stakeAmount,
      currentlyStaked,
      maxStakeAmount,
      stakePercentage: Math.round((stakedCred / maxStakeAmount) * 100),
      bonusFavor,
      isSlashing
    });
    
    setShowSuccess(true);
  };

  if (maxStakeAmount === 0) {
    return (
      <Dialog {...props} open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="flex flex-col gap-4 p-4 sm:p-6 max-w-xl"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b">
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="text-primary">
                  <ArrowLeftIcon className="size-5" />
                </Button>
              </DialogClose>
              <DialogTitle>Cannot Restake</DialogTitle>
            </div>
          </div>

          <div className="flex flex-col items-center text-center gap-6 py-8">
            <AlertCircle className="size-12 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">You haven&apos;t endorsed this point</h3>
              <p className="text-sm text-muted-foreground">
                You need to endorse this point before you can restake it.
              </p>
            </div>
            <Button 
              onClick={() => {
                onOpenChange?.(false);
                onEndorseClick?.();
              }}
            >
              Endorse Point
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showSuccess && submittedValues) {
    return (
      <Dialog {...props} open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="flex flex-col gap-6 p-4 sm:p-6 max-w-xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center">
            {submittedValues.isSlashing ? (
              <>
                <div className="rounded-full bg-destructive/20 dark:bg-destructive/10 p-3 mb-6">
                  <AlertCircle className="size-6 text-destructive dark:text-red-400" />
                </div>
                
                <div className="space-y-2 mb-6">
                  <DialogTitle className="text-xl">Stake Slashed</DialogTitle>
                  <p className="text-muted-foreground">
                    You&apos;ve lost <span className="text-destructive dark:text-red-400">
                      -{submittedValues.bonusFavor} favor
                    </span> from your original point
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-endorsed/10 p-3 mb-6">
                  <Check className="size-6 text-endorsed" />
                </div>
                
                <div className="space-y-2 mb-6">
                  <DialogTitle className="text-xl">Successfully Restaked!</DialogTitle>
                  <p className="text-muted-foreground">
                    You&apos;ve added <span className="text-endorsed">+{submittedValues.bonusFavor} favor</span> to your point
                  </p>
                </div>
              </>
            )}

            <div className="w-full space-y-6">
              <div className="space-y-2 p-4">
                <p className="text-base">{originalPoint.content}</p>
                <span className="text-sm text-muted-foreground">
                  {format(originalPoint.createdAt, "h':'mm a '·' MMM d',' yyyy")}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {submittedValues.isSlashing 
                    ? `You are losing ${submittedValues.slashAmount} cred for slashing...`
                    : `You would relinquish ${submittedValues.stakeAmount} cred if you learned...`
                  }
                </p>
                <div className="p-4 rounded-lg border border-dashed border-border hover:bg-muted cursor-pointer">
                  <p className="text-base">{counterPoint.content}</p>
                  <span className="text-muted-foreground text-sm mt-2 block">
                    {format(counterPoint.createdAt, "h':'mm a '·' MMM d',' yyyy")}
                  </span>
                </div>
              </div>

              <div className={cn(
                "rounded-lg px-4 py-3",
                submittedValues.isSlashing ? "bg-destructive/10" : "bg-muted/30"
              )}>
                <p className="text-sm text-muted-foreground">
                  {submittedValues.isSlashing ? "Amount Slashed" : "Amount Restaked"}
                </p>
                <p className="text-lg">
                  {submittedValues.isSlashing ? (
                    `${submittedValues.slashAmount} / ${submittedValues.currentlyStaked} cred (${Math.round((submittedValues.slashAmount / submittedValues.currentlyStaked) * 100)}%)`
                  ) : (
                    `${submittedValues.stakeAmount} / ${submittedValues.maxStakeAmount} cred (${submittedValues.stakePercentage}%)`
                  )}
                </p>
              </div>
            </div>

            <Button 
              className="w-full mt-6" 
              onClick={() => onOpenChange?.(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "flex flex-col gap-4 p-4 sm:p-6 max-w-xl overflow-hidden mt-4 sm:mt-0",
          // Mobile: fixed height with scrolling
          "min-h-[700px] max-h-[min(900px,85vh)]",
          // Desktop: dynamic height based on content with minimum height
          // Absolute nightmare to do this but wtv it looks good
          "sm:min-h-[850px] sm:max-h-none sm:h-auto"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-primary">
                <ArrowLeftIcon className="size-5" />
              </Button>
            </DialogClose>
            <DialogTitle>Get higher favor</DialogTitle>
          </div>
          
          <Popover open={endorsePopoverOpen} onOpenChange={toggleEndorsePopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                className={cn(
                  "border px-4",
                  (originalPoint.viewerCred || 0) > 0 && "text-endorsed"
                )}
              >
                {(originalPoint.viewerCred || 0) > 0 ? "Endorsed" : "Endorse"}
                {(originalPoint.viewerCred || 0) > 0 && (
                  <span className="ml-2">{originalPoint.viewerCred} cred</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="flex flex-col items-start w-96">
              <div className="w-full flex justify-between">
                <CredInput
                  cred={cred}
                  setCred={setCred}
                  notEnoughCred={notEnoughCred}
                />
                <Button
                  disabled={cred === 0 || notEnoughCred}
                  onClick={() => {
                    endorse({ pointId: originalPoint.id, cred }).then(() => {
                      queryClient.invalidateQueries({ 
                        queryKey: ["point", originalPoint.id] 
                      });
                      toggleEndorsePopoverOpen(false);
                    });
                  }}
                >
                  Endorse
                </Button>
              </div>
              {notEnoughCred && (
                <span className="ml-md text-destructive text-sm h-fit">
                  not enough cred
                </span>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto sm:overflow-visible">
          <div className="space-y-6 pb-36 sm:pb-0">
            {/* Original Point with Date */}
            <div className="space-y-2 pb-2">
              <div className="p-4">
                <p className="text-lg font-medium">{originalPoint.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-muted-foreground text-sm">
                    {format(originalPoint.createdAt, "h':'mm a '·' MMM d',' yyyy")}
                  </span>
                  <span className="inline-flex px-3 py-1 rounded-full bg-endorsed/10 text-endorsed text-sm">
                    {favor({ cred: originalPoint.cred, negationsCred: originalPoint.negationsCred })} favor
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline Controls */}
            <div className="flex justify-between items-center pb-2">
              <ToggleGroup
                type="single"
                value={timelineScale}
                onValueChange={(v) => v && setTimelineScale(v as TimelineScale)}
                className="flex gap-px w-fit"
              >
                {timelineScales.map((scale) => (
                  <ToggleGroupItem
                    value={scale}
                    className="w-10 h-6 text-sm text-muted-foreground"
                    key={scale}
                  >
                    {scale}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Loader
                className="text-muted-foreground size-4"
                style={{
                  display: isLoadingHistory ? "block" : "none",
                }}
              />
            </div>

            {/* Graph Section */}
            <div className="w-full h-32 relative bg-background">
              {isLoadingHistory ? (
                <Loader className="absolute left-0 right-0 mx-auto top-[20px]" />
              ) : (
                <>
                  <div className="sticky top-0 flex justify-end w-full">
                    <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-sm translate-x-[-12.5px]">
                      Projected
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={projectedData} 
                      className="[&>.recharts-surface]:overflow-visible"
                      margin={{ top: 20, right: 45, bottom: 20, left: 45 }}
                    >
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <ReferenceLine y={50} className="[&>line]:stroke-muted" />
                      <Tooltip
                        wrapperClassName="backdrop-blur-md !bg-background/15 !pb-2 !pt-1 !px-2 rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.2)] border border-border/40"
                        labelClassName="-top-3 text-muted-foreground text-xs"
                        formatter={(value: number) => value.toFixed(2)}
                        labelFormatter={(timestamp: Date) => timestamp.toLocaleString()}
                      />
                      <Line
                        animationDuration={0}
                        dataKey="favor"
                        type="stepAfter"
                        className="overflow-visible text-endorsed"
                        dot={({ cx, cy, payload, index }: any) => {
                          const isLastPoint = index === projectedData.length - 1;
                          if (!isLastPoint) return <g key={`dot-${index}`} />;

                          return (
                            <g key={`dot-${index}`}>
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={4} 
                                fill="currentColor" 
                                className="animate-none text-endorsed"
                              />
                              {bonusFavor > 0 && (
                                <text
                                  x={cx + (isSlashing ? 30 : -35)}
                                  y={cy - (isSlashing ? -15 : 10)}
                                  textAnchor={isSlashing ? "end" : "start"}
                                  fill="currentColor"
                                  className="text-xs whitespace-nowrap animate-none text-endorsed"
                                >
                                  {isSlashing ? `-${bonusFavor}` : `+${bonusFavor}`} favor
                                </text>
                              )}
                            </g>
                          );
                        }}
                        stroke="currentColor"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>

            {/* Point Stats - after the graph */}
            <div className="border-t pt-2">
              <PointStats
                className="justify-evenly ~@/lg:~text-xs/sm"
                favor={favor({ 
                  cred: originalPoint.cred,
                  negationsCred: originalPoint.negationsCred
                })}
                amountNegations={originalPoint.amountNegations}
                amountSupporters={originalPoint.amountSupporters}
                cred={originalPoint.cred}
              />
              <Separator className="my-md" />
            </div>

            {/* Warnings */}
            {isSlashing && (
              <div className="flex items-center gap-2 text-sm bg-yellow-500 dark:bg-yellow-500/90 text-black dark:text-white rounded-md p-3">
                <AlertCircle className="size-4 shrink-0" />
                <p>
                  Reducing your stake will slash your restaked cred from the original point. 
                  You&apos;ll give up {existingStakedCred - stakedCred} cred.
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {isSlashing ? (
                `You are losing ${slashAmount} cred for slashing...`
              ) : (
                `You would relinquish ${stakeAmount} cred if you learned...`
              )}
            </p>

            {/* Credibility Section with Date */}
            <div className="p-4 rounded-lg border border-dashed border-border hover:bg-muted cursor-pointer">
              <p className="text-base">{counterPoint.content}</p>
              <span className="text-muted-foreground text-sm mt-2 block">
                {format(counterPoint.createdAt, "h':'mm a '·' MMM d',' yyyy")}
              </span>
            </div>
          </div>
        </div>

        {/* Fixed bottom section */}
        <div className="sm:static fixed bottom-5 left-0 right-0 flex flex-col gap-2 border-t bg-background p-4 sm:p-0 sm:border-t-0 
          rounded-t-xl shadow-lg sm:shadow-none sm:rounded-none">
          {/* Slider Section */}
          <div className={cn(
            "space-y-4",
            maxStakeAmount === 0 && "opacity-50"
          )}>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Impact</span>
              <span className="text-sm text-muted-foreground">
                {isSlashing ? (
                  <>
                    {slashAmount} / {currentlyStaked} slashed ({currentlyStaked > 0 ? Math.round((slashAmount / currentlyStaked) * 100) : 0}%)
                  </>
                ) : (
                  <>
                    {stakeAmount} / {maxStakeAmount} staked ({maxStakeAmount > 0 ? Math.round((stakedCred / maxStakeAmount) * 100) : 0}%)
                  </>
                )}
              </span>
            </div>
            
            <Slider
              value={[stakedCred]}
              onValueChange={handleSliderChange}
              max={maxStakeAmount}
              step={1}
              className="w-full"
              destructive={isSlashing}
              disabled={maxStakeAmount === 0}
              existingCred={existingStakedCred}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <span className={cn(
              "inline-flex px-3 py-1 rounded-full text-sm",
              isSlashing 
                ? "bg-destructive/10 text-destructive dark:text-red-400"
                : "bg-endorsed/10 text-endorsed"
            )}>
              {isSlashing ? (
                <>-{bonusFavor} favor</>
              ) : (
                <>+{bonusFavor} favor</>
              )}
            </span>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange?.(false)}>
                Cancel
              </Button>
              <Button 
                variant="default" 
                className="bg-endorsed hover:bg-endorsed/90"
                onClick={handleSubmit}
                disabled={maxStakeAmount === 0 || stakedCred === 0}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps, useNavigation } from "react-day-picker"
import { format, setMonth, setYear, getMonth, getYear } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarDayState = {
  label: string;
  type?: "local" | "receiving" | "outgoing" | "assembleia" | "congresso" | "visita" | "celebracao" | "outro" | "meeting";
  isBlocked?: boolean;
};

export type CalendarProps = DayPickerProps & {
  getDayInfo?: (date: Date) => CalendarDayState | undefined;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  getDayInfo,
  modifiers: userModifiers,
  modifiersClassNames: userModifierClassNames,
  ...props
}: CalendarProps) {
  
  const modifiers = React.useMemo(() => ({
    local: (date: Date) => getDayInfo?.(date)?.type === "local",
    receiving: (date: Date) => getDayInfo?.(date)?.type === "receiving",
    outgoing: (date: Date) => getDayInfo?.(date)?.type === "outgoing",
    assembleia: (date: Date) => getDayInfo?.(date)?.type === "assembleia",
    congresso: (date: Date) => getDayInfo?.(date)?.type === "congresso",
    visita: (date: Date) => getDayInfo?.(date)?.type === "visita",
    celebracao: (date: Date) => getDayInfo?.(date)?.type === "celebracao",
    outro: (date: Date) => getDayInfo?.(date)?.type === "outro",
    booked: (date: Date) => getDayInfo?.(date)?.isBlocked === true,
    ...userModifiers,
  }), [getDayInfo, userModifiers]);

  const modifierClassNames = {
    local: "calendar-local",
    receiving: "calendar-receiving",
    outgoing: "calendar-outgoing",
    assembleia: "calendar-assembleia",
    congresso: "calendar-congresso",
    visita: "calendar-visita",
    celebracao: "calendar-celebracao",
    outro: "calendar-outro",
    booked: "calendar-booked",
    ...userModifierClassNames,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 w-full",
        month_caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-sm font-bold mx-2 capitalize",
        nav: "hidden", 
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md transition-all"
        ),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        MonthCaption: (props) => {
          const { goToMonth, nextMonth, previousMonth } = useNavigation();
          const currentMonth = props.calendarMonth.date;
          const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
          const curYear = getYear(currentMonth);
          const years = Array.from({ length: 11 }, (_, i) => 2024 + i);

          return (
            <div className="flex items-center justify-center gap-1 mb-4 py-1">
              <Button variant="outline" type="button" className="h-8 w-8 p-0 opacity-70 hover:opacity-100 border-none bg-transparent" disabled={!previousMonth} onClick={() => previousMonth && goToMonth(previousMonth)}><ChevronLeft className="h-4 w-4" /></Button>
              <Popover>
                <PopoverTrigger asChild><Button variant="ghost" className="text-sm font-bold px-1 capitalize min-w-[120px] text-center h-8 hover:bg-muted/50">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</Button></PopoverTrigger>
                <PopoverContent className="w-64 p-3 shadow-xl border-none z-[150]" align="center">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Mês</label><Select value={getMonth(currentMonth).toString()} onValueChange={(v) => goToMonth(setMonth(currentMonth, parseInt(v)))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent className="z-[160]">{months.map((m, i) => (<SelectItem key={i} value={i.toString()} className="text-xs">{m}</SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-muted-foreground px-1">Ano</label><Select value={curYear.toString()} onValueChange={(v) => goToMonth(setYear(currentMonth, parseInt(v)))}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent className="z-[160]">{years.map(y => (<SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>))}</SelectContent></Select></div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" type="button" className="h-8 w-8 p-0 opacity-70 hover:opacity-100 border-none bg-transparent" disabled={!nextMonth} onClick={() => nextMonth && goToMonth(nextMonth)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          );
        },
      }}
      modifiers={modifiers}
      modifiersClassNames={modifierClassNames}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
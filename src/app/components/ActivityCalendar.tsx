import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase-client";

interface MessageLog {
  id: string;
  lead_id: string | null;
  customer_phone: string;
  template_type: string;
  sent_at: string;
  created_at: string;
}

interface DayData {
  date: Date;
  count: number;
  messages: MessageLog[];
}

interface ActivityCalendarProps {
  agentId: string;
  refreshTrigger: number;
}

export function ActivityCalendar({ agentId, refreshTrigger }: ActivityCalendarProps) {
  const [days, setDays] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivityData();

    // Set up real-time subscription for message_logs
    console.log("🔔 Setting up real-time subscription for message_logs...");
    
    const channel = supabase
      .channel('message_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_logs',
          filter: `agent_id=eq.${agentId}`
        },
        (payload) => {
          console.log('🔔 Real-time update received:', payload);
          
          // Immediately refresh the calendar data
          fetchActivityData();
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log("🔌 Cleaning up real-time subscription...");
      supabase.removeChannel(channel);
    };
  }, [agentId, refreshTrigger]);

  const fetchActivityData = async () => {
    try {
      setIsLoading(true);

      // Get last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      console.log("📅 Fetching activity data...");
      console.log("  Agent ID:", agentId);
      console.log("  Date range:", thirtyDaysAgo.toISOString(), "to", today.toISOString());

      // Fetch message logs for the last 30 days
      const { data, error } = await supabase
        .from("message_logs")
        .select("id, lead_id, customer_phone, template_type, sent_at, created_at")
        .eq("agent_id", agentId)
        .gte("sent_at", thirtyDaysAgo.toISOString())
        .order("sent_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching activity data:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        // If table doesn't exist or network error, show empty calendar
        if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("Failed to fetch")) {
          console.log("⚠️ Database unavailable - showing empty calendar");
          setDays(generateEmptyDays());
          setIsLoading(false);
          return;
        }
        setDays(generateEmptyDays());
        setIsLoading(false);
        return;
      }

      console.log(`✅ Fetched ${data?.length || 0} message logs`);
      if (data && data.length > 0) {
        console.log("  Sample message:", data[0]);
      }

      // Group messages by date (using local date, not UTC)
      const dayMap = new Map<string, MessageLog[]>();
      
      data?.forEach((msg) => {
        const msgDate = new Date(msg.sent_at);
        // Convert to local date string for grouping
        const localDate = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
        const dateKey = localDate.toISOString().split("T")[0];
        
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey)?.push(msg);
      });

      console.log("📊 Messages grouped by date:", Object.fromEntries(dayMap));

      // Create array of last 30 days
      const daysArray: DayData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dateKey = date.toISOString().split("T")[0];
        const messages = dayMap.get(dateKey) || [];
        
        daysArray.push({
          date,
          count: messages.length,
          messages,
        });
      }

      setDays(daysArray);
    } catch (err) {
      console.error("Error in fetchActivityData:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "short" });
    return `${day} ${month}`;
  };

  const getDayName = (date: Date): string => {
    return date.toLocaleString("default", { weekday: "short" });
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#666",
          fontSize: "14px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #5a8f5c",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading activity...
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
        marginTop: "24px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#1a1a1a",
            marginBottom: "4px",
          }}
        >
          📊 Activity Tracker
        </h3>
        <p style={{ fontSize: "13px", color: "#666", margin: 0 }}>
          Last 30 days • Click any day to see details
        </p>
      </div>

      {/* Today's Count Summary */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayData = days.find(d => {
          const dayDate = new Date(d.date);
          dayDate.setHours(0, 0, 0, 0);
          return dayDate.getTime() === today.getTime();
        });
        const todayCount = todayData?.count || 0;

        return (
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)",
              borderRadius: "12px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", fontWeight: "600" }}>
                Messages Sent Today
              </div>
              <div style={{ fontSize: "32px", color: "white", fontWeight: "800", marginTop: "4px" }}>
                {todayCount}
              </div>
            </div>
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              📤
            </div>
          </div>
        );
      })()}

      {/* Calendar Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))",
          gap: "8px",
          marginBottom: selectedDay ? "24px" : "0",
        }}
      >
        {days.map((day, index) => {
          const isSelected = selectedDay?.date.getTime() === day.date.getTime();
          const today = isToday(day.date);

          return (
            <button
              key={index}
              onClick={() => setSelectedDay(day.count > 0 ? day : null)}
              style={{
                position: "relative",
                padding: "12px 8px",
                background: isSelected
                  ? "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)"
                  : today
                  ? "#f0fdf4"
                  : day.count > 0
                  ? "#f8f9fa"
                  : "transparent",
                border: today
                  ? "2px solid #5a8f5c"
                  : isSelected
                  ? "2px solid #5a8f5c"
                  : "1px solid #e5e7eb",
                borderRadius: "10px",
                cursor: day.count > 0 ? "pointer" : "default",
                transition: "all 0.2s",
                fontFamily: "Inter, sans-serif",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                if (day.count > 0) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Day name */}
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: isSelected ? "white" : "#999",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                }}
              >
                {getDayName(day.date)}
              </div>

              {/* Day number */}
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: isSelected ? "white" : today ? "#5a8f5c" : "#1a1a1a",
                  marginBottom: "4px",
                }}
              >
                {day.date.getDate()}
              </div>

              {/* Count badge */}
              {day.count > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    minWidth: "20px",
                    height: "20px",
                    padding: "2px 6px",
                    background: isSelected
                      ? "rgba(255, 255, 255, 0.3)"
                      : "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)",
                    color: "white",
                    fontSize: "11px",
                    fontWeight: "700",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {day.count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Details */}
      {selectedDay && selectedDay.count > 0 && (
        <div
          style={{
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h4
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "#1a1a1a",
                margin: 0,
              }}
            >
              📅 {formatDate(selectedDay.date)} • {selectedDay.count} messages sent
            </h4>
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                color: "#666",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
              }}
            >
              Close
            </button>
          </div>

          {/* Message List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {selectedDay.messages.map((msg, idx) => (
              <div
                key={msg.id}
                style={{
                  padding: "12px 16px",
                  background: "white",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#999",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                    }}
                  >
                    Lead ID
                  </div>
                  <div style={{ fontWeight: "600", color: "#1a1a1a" }}>
                    {msg.lead_id || "N/A"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#999",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                    }}
                  >
                    Phone Number
                  </div>
                  <div style={{ fontWeight: "600", color: "#1a1a1a" }}>
                    +{msg.customer_phone}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#999",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                    }}
                  >
                    Template Type
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      background:
                        msg.template_type === "quick"
                          ? "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)"
                          : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      color: "white",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "6px",
                      textTransform: "capitalize",
                    }}
                  >
                    {msg.template_type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// Helper function to generate empty days for the calendar
function generateEmptyDays(): DayData[] {
  const today = new Date();
  const daysArray: DayData[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const dateKey = date.toISOString().split("T")[0];
    
    daysArray.push({
      date,
      count: 0,
      messages: [],
    });
  }

  return daysArray;
}
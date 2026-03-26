import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const logoImage = "/logo.gif";

interface ProfileHeaderProps {
  onLogout: () => void;
}

export function ProfileHeader({ onLogout }: ProfileHeaderProps) {
  const [profile, setProfile] = useState<{
    full_name: string;
    profile_pic_url: string | null;
    email: string;
  } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const fetchProfile = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("❌ Authentication Error in ProfileHeader:", authError);
        // Set a default profile to prevent UI breaking
        setProfile({
          full_name: "User",
          profile_pic_url: null,
          email: "Not available"
        });
        return;
      }
      
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, profile_pic_url")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          // Set basic profile with user email
          setProfile({
            full_name: "User",
            profile_pic_url: null,
            email: user.email || "N/A"
          });
          return;
        }

        setProfile({
          ...data,
          email: user.email || "N/A"
        });
      }
    } catch (err) {
      console.error("❌ Exception in fetchProfile:", err);
      // Set a default profile to prevent UI breaking
      setProfile({
        full_name: "User",
        profile_pic_url: null,
        email: "Not available"
      });
    }
  };

  const handleLogout = async () => {
    // Call parent logout immediately — do NOT call supabase.auth.signOut() here
    // because AuthContext.logout() already handles it (fire-and-forget) and
    // calling it twice causes a race condition that delays the UI update.
    onLogout();
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "0",
        right: "0",
        left: "0",
        zIndex: 1000,
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Logo/Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "white",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
            }}
          >
            <img 
              src={logoImage} 
              alt="QHT Logo" 
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          <div>
            <h1
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#1a1a1a",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              QHT Clinic
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "#666",
                margin: 0,
              }}
            >
              WhatsApp Message Sender
            </p>
          </div>
        </div>

        {/* Profile Section - Clickable Dropdown */}
        {profile && (
          <div style={{ position: "relative" }} ref={dropdownRef}>
            {/* Clickable Profile Avatar Button */}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 16px 8px 8px",
                background: isDropdownOpen ? "#f8f9fa" : "transparent",
                border: isDropdownOpen ? "2px solid #5a8f5c" : "2px solid transparent",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "Inter, sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!isDropdownOpen) {
                  e.currentTarget.style.background = "#f8f9fa";
                }
              }}
              onMouseLeave={(e) => {
                if (!isDropdownOpen) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Profile Avatar with Initials */}
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "2px solid #5a8f5c",
                  background: profile.profile_pic_url
                    ? "transparent"
                    : "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "700",
                  color: "white",
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                {profile.profile_pic_url ? (
                  <img
                    src={profile.profile_pic_url}
                    alt={profile.full_name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  getInitials(profile.full_name)
                )}
              </div>

              {/* Dropdown Chevron Icon */}
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666",
                  transition: "transform 0.2s",
                  transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: "0",
                  width: "280px",
                  background: "white",
                  borderRadius: "12px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  zIndex: 1001,
                  animation: "slideDown 0.2s ease-out",
                }}
              >
                {/* Profile Info Section */}
                <div
                  style={{
                    padding: "20px",
                    borderBottom: "1px solid #e5e7eb",
                    background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "3px solid #5a8f5c",
                        background: profile.profile_pic_url
                          ? "transparent"
                          : "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        color: "white",
                        fontSize: "20px",
                        flexShrink: 0,
                      }}
                    >
                      {profile.profile_pic_url ? (
                        <img
                          src={profile.profile_pic_url}
                          alt={profile.full_name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        getInitials(profile.full_name)
                      )}
                    </div>

                    {/* Name and Title */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "#1a1a1a",
                          marginBottom: "4px",
                          lineHeight: "1.3",
                        }}
                      >
                        {profile.full_name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          color: "#5a8f5c",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Agent
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "white",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#999",
                        textTransform: "uppercase",
                        marginBottom: "4px",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Email Address
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#1a1a1a",
                        wordBreak: "break-word",
                      }}
                    >
                      {profile.email}
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div style={{ padding: "12px" }}>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleLogout();
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "Inter, sans-serif",
                      color: "white",
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(220, 38, 38, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(220, 38, 38, 0.3)";
                    }}
                  >
                    {/* Logout Icon */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}

            {/* Animation Keyframes */}
            <style>{`
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
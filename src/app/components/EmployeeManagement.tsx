import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase-client";
import { env } from "@/config/env";

const API_BASE = env.serverUrl;

interface Employee {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "agent";
  profile_pic_url: string | null;
  created_at: string;
}

interface EmployeeManagementProps {
  onClose?: () => void;
}

export function EmployeeManagement({ onClose }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "agent" as "admin" | "agent",
  });
  const [newPassword, setNewPassword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE}/employees`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch employees");
      }

      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (err: any) {
      console.error("Fetch employees error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.email || !newEmployee.password || !newEmployee.full_name) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      let profile_pic_url = null;

      // Upload image if provided
      if (imageFile) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        
        await new Promise((resolve) => {
          reader.onload = async () => {
            const base64Image = reader.result as string;
            
            const uploadResponse = await fetch(`${API_BASE}/upload-profile-pic`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                base64Image,
                fileName: imageFile.name,
              }),
            });

            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              profile_pic_url = uploadData.url;
            }
            
            resolve(true);
          };
        });
      }

      const response = await fetch(`${API_BASE}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...newEmployee,
          profile_pic_url,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create employee");
      }

      setSuccess("Employee added successfully!");
      setShowAddModal(false);
      setNewEmployee({ email: "", password: "", full_name: "", role: "agent" });
      setImageFile(null);
      setImagePreview(null);
      fetchEmployees();
    } catch (err: any) {
      console.error("Add employee error:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE}/employees/${employeeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete employee");
      }

      setSuccess("Employee deleted successfully!");
      fetchEmployees();
    } catch (err: any) {
      console.error("Delete employee error:", err);
      setError(err.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedEmployee || !newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`${API_BASE}/employees/${selectedEmployee.id}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update password");
      }

      setSuccess("Password updated successfully!");
      setShowPasswordModal(false);
      setNewPassword("");
      setSelectedEmployee(null);
    } catch (err: any) {
      console.error("Update password error:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfilePic = async () => {
    if (!selectedEmployee || !imageFile) {
      setError("Please select an image");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      // Upload image
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      
      await new Promise((resolve) => {
        reader.onload = async () => {
          const base64Image = reader.result as string;
          
          const uploadResponse = await fetch(`${API_BASE}/upload-profile-pic`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              base64Image,
              fileName: imageFile.name,
            }),
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload image");
          }

          const uploadData = await uploadResponse.json();
          
          // Update profile picture URL
          const updateResponse = await fetch(`${API_BASE}/employees/${selectedEmployee.id}/profile-pic`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ profile_pic_url: uploadData.url }),
          });

          if (!updateResponse.ok) {
            throw new Error("Failed to update profile picture");
          }

          resolve(true);
        };
      });

      setSuccess("Profile picture updated successfully!");
      setShowImageModal(false);
      setImageFile(null);
      setImagePreview(null);
      setSelectedEmployee(null);
      fetchEmployees();
    } catch (err: any) {
      console.error("Update profile picture error:", err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1a1a" }}>
          Employee Management
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: "600",
            color: "white",
            background: "#5a8f5c",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#4a7a4f";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#5a8f5c";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <span style={{ fontSize: "16px" }}>👤➕</span>
          Add New Employee
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "#fee",
          color: "#c00",
          borderRadius: "8px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>
      )}

      {success && (
        <div style={{
          padding: "12px 16px",
          background: "#efe",
          color: "#080",
          borderRadius: "8px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>×</button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "48px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "4px solid #5a8f5c",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{
          background: "white",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>Profile</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>Name</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>Email</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>Role</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#666" }}>Joined</th>
                <th style={{ padding: "16px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#666" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "16px" }}>
                    {employee.profile_pic_url ? (
                      <img
                        src={employee.profile_pic_url}
                        alt={employee.full_name}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "#5a8f5c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "600",
                        fontSize: "16px",
                      }}>
                        {employee.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", fontWeight: "500", color: "#1a1a1a" }}>
                    {employee.full_name}
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#666" }}>
                    {employee.email}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      background: employee.role === "admin" ? "#fef3c7" : "#dbeafe",
                      color: employee.role === "admin" ? "#92400e" : "#1e40af",
                    }}>
                      {employee.role}
                    </span>
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", color: "#666" }}>
                    {new Date(employee.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowImageModal(true);
                        }}
                        title="Update Profile Picture"
                        style={{
                          padding: "8px 12px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontSize: "14px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#2563eb"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#3b82f6"}
                      >
                        📷
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setShowPasswordModal(true);
                        }}
                        title="Change Password"
                        style={{
                          padding: "8px 12px",
                          background: "#f59e0b",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontSize: "14px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#d97706"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#f59e0b"}
                      >
                        🔑
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
                        title="Delete Employee"
                        style={{
                          padding: "8px 12px",
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          fontSize: "14px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#b91c1c"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "#dc2626"}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {employees.length === 0 && !isLoading && (
            <div style={{ textAlign: "center", padding: "48px", color: "#999" }}>
              <p style={{ fontSize: "16px" }}>No employees found</p>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a" }}>Add New Employee</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewEmployee({ email: "", password: "", full_name: "", role: "agent" });
                  setImageFile(null);
                  setImagePreview(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "#999" }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                Email *
              </label>
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="email@example.com"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                Password *
              </label>
              <input
                type="password"
                value={newEmployee.password}
                onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                placeholder="Minimum 6 characters"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                Full Name *
              </label>
              <input
                type="text"
                value={newEmployee.full_name}
                onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                placeholder="John Doe"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                Role *
              </label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as "admin" | "agent" })}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  outline: "none",
                }}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                Profile Picture (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    marginTop: "12px",
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              )}
            </div>

            <button
              onClick={handleAddEmployee}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                fontWeight: "600",
                color: "white",
                background: isSubmitting ? "#94b896" : "#5a8f5c",
                border: "none",
                borderRadius: "10px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && selectedEmployee && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "400px",
            width: "90%",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a" }}>Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword("");
                  setSelectedEmployee(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "#999" }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
              Update password for <strong>{selectedEmployee.full_name}</strong>
            </p>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                fontWeight: "600",
                color: "white",
                background: isSubmitting ? "#f5b96e" : "#f59e0b",
                border: "none",
                borderRadius: "10px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageModal && selectedEmployee && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            background: "white",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: "400px",
            width: "90%",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1a1a1a" }}>Update Profile Picture</h3>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setImageFile(null);
                  setImagePreview(null);
                  setSelectedEmployee(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "#999" }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
              Update profile picture for <strong>{selectedEmployee.full_name}</strong>
            </p>

            <div style={{ marginBottom: "24px" }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "14px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{
                    marginTop: "12px",
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    margin: "12px auto 0",
                    display: "block",
                  }}
                />
              )}
            </div>

            <button
              onClick={handleUpdateProfilePic}
              disabled={isSubmitting || !imageFile}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                fontWeight: "600",
                color: "white",
                background: isSubmitting || !imageFile ? "#94c5f8" : "#3b82f6",
                border: "none",
                borderRadius: "10px",
                cursor: isSubmitting || !imageFile ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Uploading..." : "Update Picture"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
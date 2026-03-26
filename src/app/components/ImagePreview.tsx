interface ImagePreviewProps {
  imageUrl: string;
  onClear: () => void;
}

export function ImagePreview({ imageUrl, onClear }: ImagePreviewProps) {
  return (
    <div
      className="w-full bg-white rounded-[20px] animate-fadeIn"
      style={{
        padding: "30px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header with Clear Button */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-[18px] font-bold"
          style={{ color: "#5a8f5c" }}
        >
          Selected Image
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] font-semibold rounded-[8px] border-0 cursor-pointer transition-all duration-200"
          style={{
            padding: "8px 16px",
            background: "#f5f5f5",
            color: "#666",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#ff4444";
            e.currentTarget.style.color = "white";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.color = "#666";
          }}
        >
          Clear Image
        </button>
      </div>

      {/* Image Display */}
      <div
        className="overflow-hidden rounded-[12px]"
        style={{
          border: "2px solid #5a8f5c",
        }}
      >
        <img
          src={imageUrl}
          alt="Selected template"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            maxHeight: "400px",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Info Text */}
      <p
        className="text-[12px] text-center mt-3"
        style={{ color: "#666", fontStyle: "italic" }}
      >
        This image will be sent with your message
      </p>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

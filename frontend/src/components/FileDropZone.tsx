import React, { useCallback, useState } from "react";

type FileDropZoneProps = {
  label?: string;
  onFilesSelected: (files: File[]) => void;
  inputId: string; // 각 영역별로 다른 id 전달
};

const FileDropZone: React.FC<FileDropZoneProps> = ({
  label = "파일을 드래그하거나 클릭해서 업로드하세요",
  onFilesSelected,
  inputId,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;
      onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onChangeInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: "2px dashed #c4b5fd",
        borderRadius: 12,
        padding: 12,
        textAlign: "center",
        backgroundColor: isDragging ? "#f5f3ff" : "white",
        cursor: "pointer",
        fontSize: 12,
      }}
      onClick={() => {
        const input = document.getElementById(
          inputId
        ) as HTMLInputElement | null;
        input?.click();
      }}
    >
      <input
        id={inputId}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={onChangeInput}
      />
      <div>{label}</div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
        여러 파일을 한 번에 올릴 수 있습니다.
      </div>
    </div>
  );
};

export default FileDropZone;

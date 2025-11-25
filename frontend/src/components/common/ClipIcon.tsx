// src/components/common/ClipIcon.tsx

import React from "react";

export type ClipIconProps = {
  size?: number;
};

const ClipIcon: React.FC<ClipIconProps> = ({ size = 16 }) => {
  return (
    <span
      style={{
        fontSize: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      📎
    </span>
  );
};

export default ClipIcon;

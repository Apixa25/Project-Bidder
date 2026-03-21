"use client";

import {
  ReactCompareSlider,
  ReactCompareSliderImage,
  ReactCompareSliderHandle,
} from "react-compare-slider";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "After",
}: BeforeAfterSliderProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage
            src={beforeUrl}
            alt={beforeLabel}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={afterUrl}
            alt={afterLabel}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        }
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: "none",
              background: "white",
              border: "2px solid #e67e22",
              color: "#e67e22",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              width: 36,
              height: 36,
            }}
            linesStyle={{
              width: 3,
              color: "#e67e22",
            }}
          />
        }
        style={{ height: "100%", width: "100%" }}
        className="aspect-video"
      />

      {/* Labels */}
      <div className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white shadow">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white shadow">
        {afterLabel}
      </div>
    </div>
  );
}

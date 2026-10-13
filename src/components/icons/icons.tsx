import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base: IconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const CheckIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m3.5 8.5 3 3 6-7" />
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
)

export const SparkleIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.4 4.4l1.6 1.6M10 10l1.6 1.6M11.6 4.4 10 6M6 10l-1.6 1.6" />
  </svg>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m10 3.5-4.5 4.5 4.5 4.5" />
  </svg>
)

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 3.5 4.5 4.5-4.5 4.5" />
  </svg>
)

export const ArrowUpIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 13V3.5M4 7.5l4-4 4 4" />
  </svg>
)
export type AppHealth = {
  all: ComponentStatus;
  db: ComponentStatus;
  schema: ComponentStatus;
};

export type ComponentStatus = {
  status: "GREEN" | "RED" | "UNKNOWN";
};

const health: AppHealth = {
  all: {
    status: "UNKNOWN"
  },
  db: {
    status: "UNKNOWN"
  },
  schema: {
    status: "UNKNOWN"
  }
};

export function setStatus(component: keyof AppHealth, status: ComponentStatus) {
  health[component] = status;
}

export function getHealth(): AppHealth {
  return health;
}

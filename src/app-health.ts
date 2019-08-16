export type AppHealth = {
  all: ComponentStatus;
  db: ComponentStatus;
  schema: ComponentStatus;
  egoPublicKey: ComponentStatus;
};

export type ComponentStatus = {
  status: "GREEN" | "RED" | "UNKNOWN";
  info?: any;
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
  },
  egoPublicKey: {
    status: "UNKNOWN"
  }
};

export function setStatus(component: keyof AppHealth, status: ComponentStatus) {
  health[component] = status;
  for (const k in health) {
    const key = k as keyof AppHealth;
    if (key == "all") {
      continue;
    }
    if (health[key].status !== "GREEN") {
      health["all"].status = "RED";
      return;
    }
  }
  health["all"].status = "GREEN";
}

export function getHealth(): AppHealth {
  return health;
}

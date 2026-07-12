import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { Camera, ClipboardText, Minus, PushPinSimple } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api";
import { appWindow } from "@tauri-apps/api/window";
import { Fragment, useCallback } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import getVersion from "@/hooks/getVersion";
import { useMeterSettingsStore } from "@/stores/useMeterSettingsStore";
import { EncounterState, PlayerData, SortDirection, SortType } from "@/types";
import {
  exportFullEncounterToClipboard,
  exportScreenshotToClipboard,
  exportSimpleEncounterToClipboard,
  findPartySlotIndex,
  formatInPartyOrder,
  humanizeNumbers,
  millisecondsToElapsedFormat,
} from "@/utils";

const TeamDamageStats = ({ encounterState }: { encounterState: EncounterState }) => {
  const [teamDps, dpsUnit] = humanizeNumbers(encounterState.dps);
  const [totalTeamDmg, dmgUnit] = humanizeNumbers(encounterState.totalDamage);

  return (
    <Fragment>
      <div data-tauri-drag-region className="encounter-totalDamage item">
        - {totalTeamDmg}
        <span className="unit font-sm">{dmgUnit} -</span>
      </div>
      <div data-tauri-drag-region className="encounter-totalDps item">
        {teamDps}
        <span className="unit font-sm">{dpsUnit}/s</span>
      </div>
    </Fragment>
  );
};

const EncounterStatus = ({ encounterState, elapsedTime }: { encounterState: EncounterState; elapsedTime: number }) => {
  if (encounterState.status === "Waiting") {
    return (
      <div data-tauri-drag-region className="encounter-status item">
        {encounterState.status}..
      </div>
    );
  } else if (encounterState.status === "InProgress") {
    return (
      <Fragment>
        <div data-tauri-drag-region className="encounter-elapsedTime item">
          {millisecondsToElapsedFormat(elapsedTime)}
        </div>
      </Fragment>
    );
  } else if (encounterState.status === "Stopped") {
    return (
      <Fragment>
        <div data-tauri-drag-region className="encounter-elapsedTime item">
          {millisecondsToElapsedFormat(encounterState.endTime - encounterState.startTime)}
        </div>
      </Fragment>
    );
  }
};

export const Titlebar = ({
  encounterState,
  partyData,
  elapsedTime,
  sortType,
  sortDirection,
}: {
  encounterState: EncounterState;
  partyData: Array<PlayerData | null>;
  elapsedTime: number;
  sortType: SortType;
  sortDirection: SortDirection;
}) => {
  const { t } = useTranslation();
  const { version } = getVersion();

  const onMinimize = () => {
    appWindow.minimize();
  };
  const onPin = () => {
    invoke("toggle_always_on_top");
  };

  const handleSimpleEncounterCopy = useCallback(() => {
    exportSimpleEncounterToClipboard(sortType, sortDirection, encounterState, partyData);
  }, [encounterState]);

  const handleFullEncounterCopy = useCallback(() => {
    exportFullEncounterToClipboard(sortType, sortDirection, encounterState, partyData);
  }, [encounterState]);

  const handleDumpDebugInfo = useCallback(async () => {
    const settings = useMeterSettingsStore.getState();

    // Build diagnostic info about player matching
    const orderedPlayers = formatInPartyOrder(encounterState.party, partyData);
    const matchDiagnostics = orderedPlayers.map((player) => {
      const matchedSlot = findPartySlotIndex(player, partyData);
      const usedBackendPartyIndex =
        player.partyIndex !== undefined &&
        player.partyIndex >= 0 &&
        player.partyIndex < 4 &&
        partyData[player.partyIndex] &&
        typeof partyData[player.partyIndex]?.characterType === 'string' &&
        partyData[player.partyIndex]?.characterType === player.characterType;
      const usedActorIndex =
        !usedBackendPartyIndex &&
        partyData.findIndex((pm) => pm?.actorIndex === player.index) !== -1;
      const usedCharacterTypeFallback = !usedBackendPartyIndex && !usedActorIndex && matchedSlot !== -1;

      return {
        playerIndex: player.index,
        characterType: player.characterType,
        assignedPartyIndex: player.partyIndex,
        matchedPartySlot: matchedSlot,
        matchMethod: usedBackendPartyIndex
          ? 'backend_party_index'
          : usedActorIndex
            ? 'actor_index'
            : usedCharacterTypeFallback
              ? 'character_type_fallback'
              : 'none',
        totalDamage: player.totalDamage,
      };
    });

    // Summarize partyData
    const partyDataSummary = partyData.map((pd, i) =>
      pd
        ? {
            slot: i,
            actorIndex: pd.actorIndex,
            partyIndex: pd.partyIndex,
            characterType: pd.characterType,
            displayName: pd.displayName || '(empty)',
            isOnline: pd.isOnline,
          }
        : { slot: i, empty: true }
    );

    // Try to get backend diagnostics (only available in logs view with a valid log ID)
    let backendDiagnostics = null;
    try {
      // Extract log ID from URL path if we're on the logs page (/logs/:id)
      const pathMatch = window.location.pathname.match(/\/logs\/(\d+)/);
      const logId = pathMatch ? pathMatch[1] : null;
      if (logId) {
        backendDiagnostics = await invoke('get_dump_diagnostics', {
          id: Number(logId),
        });
      }
    } catch {
      // Backend diagnostics not available (live meter or no log loaded)
    }

    const debugInfo = {
      timestamp: Date.now(),
      version,
      platform: {
        userAgent: navigator.userAgent,
        language: navigator.language,
      },
      settings: {
        color_1: settings.color_1,
        color_2: settings.color_2,
        color_3: settings.color_3,
        color_4: settings.color_4,
        show_display_names: settings.show_display_names,
        streamer_mode: settings.streamer_mode,
        show_full_values: settings.show_full_values,
        overlay_columns: settings.overlay_columns,
      },
      encounterState,
      partyData,
      partyDataSummary,
      matchDiagnostics,
      backendDiagnostics,
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => {
        toast.success("Debug info copied! Paste it to Antigravity.");
      })
      .catch((err) => {
        toast.error("Failed to copy debug info: " + err);
      });
  }, [encounterState, partyData, version]);

  return (
    <div data-tauri-drag-region className="titlebar transparent-bg font-sm">
      <div data-tauri-drag-region className="titlebar-left">
        <div data-tauri-drag-region className="version">
          GBFR Logs Awa Edition <span className="version-number">{version}</span>
        </div>
        {encounterState.totalDamage > 0 && <TeamDamageStats encounterState={encounterState} />}
      </div>
      <div data-tauri-drag-region className="titlebar-right">
        <EncounterStatus encounterState={encounterState} elapsedTime={elapsedTime} />
        <Menu shadow="md" trigger="hover" openDelay={100} closeDelay={400}>
          <Menu.Target>
            <ActionIcon aria-label="Clipboard" variant="transparent" color="light">
              <ClipboardText size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={handleSimpleEncounterCopy}>{t("ui.copy-to-clipboard-simple")}</Menu.Item>
            <Menu.Item onClick={handleFullEncounterCopy}>{t("ui.copy-to-clipboard-full")}</Menu.Item>
            <Menu.Item onClick={handleDumpDebugInfo}>Dump Debug Info</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Tooltip label="Pin window" color="dark">
          <div className="titlebar-button" id="titlebar-snapshot" onClick={onPin}>
            <PushPinSimple size={16} />
          </div>
        </Tooltip>
        <Tooltip label="Copy screenshot to clipboard" color="dark">
          <div className="titlebar-button" id="titlebar-snapshot" onClick={() => exportScreenshotToClipboard(".app")}>
            <Camera size={16} />
          </div>
        </Tooltip>
        <div className="titlebar-button" id="titlebar-minimize" onClick={onMinimize}>
          <Minus size={16} />
        </div>
      </div>
    </div>
  );
};

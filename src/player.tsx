import "./twitch-embed";
import * as React from "react";
import load from "./vendor/little-loader";
import classnames from "classnames";
import { useAppState, makeActionToggleMinimized, makeActionSetVideoHeight } from "./state";
import { throttle } from "lodash";

const loadTwitchEmbed =
  process.env.JEST_WORKER_ID !== undefined
    ? new Promise<void>(() => {})
    : new Promise<void>((resolve, reject) => {
        load("https://player.twitch.tv/js/embed/v1.js", (err) => {
          err ? reject(err) : resolve();
        });
      });

interface Load {
  error?: any;
  loading: boolean;
}

export const Player: React.FC = function() {
  const [{ error, loading }, setState] = React.useState<Load>({ loading: true });

  React.useEffect(() => {
    const done = (d?: Partial<Load>) => setState({ ...d, loading: false });
    loadTwitchEmbed.then(() => done(), (error) => done({ error }));
  }, []);

  if (error) return <div style={{ color: "red" }}>{error.toString()}</div>;

  if (loading) return <div>Loading</div>;

  return <PlayerInner />;
};

export const PlayerInner: React.FC = function() {
  const [dragging, setDragging] = React.useState(false);
  const [{ minimized, videoHeight = 300 }, dispatch] = useAppState();
  const [setHeight] = React.useState(() =>
    throttle((height?: number) => {
      dispatch(makeActionSetVideoHeight(height));
    }, 1000 / 30)
  );

  return (
    <div
      className={classnames("player", { dragging, minimized })}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains("control-bar")) return;

        let onmousemove: (ev: MouseEvent) => any;
        let onmouseup: (ev: MouseEvent) => any;
        let y = e.pageY;
        let height = videoHeight;

        document.addEventListener(
          "mousemove",
          (onmousemove = (evt) => {
            setHeight(height + (evt.pageY - y));
          })
        );

        document.addEventListener(
          "mouseup",
          (onmouseup = () => {
            document.removeEventListener("mousemove", onmousemove);
            document.removeEventListener("mouseup", onmouseup);
            setDragging(false);
          })
        );

        setDragging(true);
      }}
    >
      <div className="click-absorber" />
      <TwitchPlayer />
      <ControlBar />
      <Chat />
    </div>
  );
};

export const TwitchPlayer: React.FC = function() {
  const TwitchPlayerRef = React.useRef<Twitch.Player>();
  const [{ channel, minimized, videoHeight = 300 }] = useAppState();

  React.useEffect(() => {
    if (channel == null) return;

    const el = document.getElementById("twitch-player");
    if (el == null) throw new Error("no element");

    const player = (TwitchPlayerRef.current = new Twitch.Player("twitch-player", {
      channel,
      width: el.offsetWidth,
      height: videoHeight,
    }));

    return () => {
      player.destroy();
      TwitchPlayerRef.current = undefined;
    };
  }, [
    // only the channel, not the height because we only want to recreate the player object when the channel changes
    channel,
  ]);

  React.useEffect(() => {
    const frame: HTMLIFrameElement | null = document.querySelector("#twitch-player > iframe");
    if (frame) frame.height = videoHeight + "px";
  }, [videoHeight]);

  React.useEffect(() => {
    let listener: () => any;
    window.addEventListener(
      "resize",
      (listener = throttle(() => {
        const el = document.getElementById("twitch-player");
        if (el == null) return;

        const frame: HTMLIFrameElement | null = el.querySelector("iframe");
        if (frame) frame.width = el.offsetWidth + "px";
      }, 250))
    );

    return () => {
      window.removeEventListener("resize", listener);
    };
  }, []);

  return <div className="twitch-player" id="twitch-player" style={{ height: minimized ? 0 : videoHeight }} />;
};

export const ControlBar: React.FC = function() {
  const [, dispatch] = useAppState();

  return (
    <div className="control-bar">
      <button
        className="minimize"
        onClick={() => {
          dispatch(makeActionToggleMinimized());
        }}
      />
    </div>
  );
};

export const Chat: React.FC = function() {
  const [{ channel }] = useAppState();
  return channel ? (
    <iframe
      className="twitch-chat"
      frameBorder="0"
      scrolling="no"
      src={`https://www.twitch.tv/embed/${channel}/chat`}
    />
  ) : null;
};

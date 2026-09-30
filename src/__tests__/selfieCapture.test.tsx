import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SelfieCaptureView, SelfieDoneView } from '@features/service/ServiceV14Views';

/**
 * `1:10236` / `1:10275` — the arrival selfie.
 *
 * The camera is on when the screen opens, `Photo` takes the picture, and nothing leaves the phone
 * until she presses `Bheje` -- a retake is free.
 */

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};
const mockRequestPermission = jest.fn(async () => ({ granted: true }));
const mockTakePicture = jest.fn(async () => ({ uri: 'file:///selfie.jpg' }));

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  const CameraView = forwardRef((props: { testID?: string }, ref: unknown) => {
    useImperativeHandle(ref, () => ({ takePictureAsync: mockTakePicture }));
    return <View testID={props.testID} />;
  });
  CameraView.displayName = 'CameraView';
  return {
    CameraView,
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true };
  mockRequestPermission.mockClear();
  mockTakePicture.mockClear();
});

async function takePhoto(): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByTestId('selfie-capture'));
  });
}

describe('the arrival selfie', () => {
  it('opens on the front camera with no photo taken', () => {
    render(<SelfieCaptureView />);
    expect(screen.getByTestId('selfie-camera')).toBeTruthy();
    expect(screen.queryByTestId('selfie-preview')).toBeNull();
  });

  it('asks for the camera as the screen opens when it has not been granted', () => {
    mockPermission = { granted: false, canAskAgain: true };
    render(<SelfieCaptureView />);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('explains a refused permission instead of showing a dead camera', () => {
    mockPermission = { granted: false, canAskAgain: false };
    render(<SelfieCaptureView />);
    expect(screen.getByTestId('selfie-denied')).toBeTruthy();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('shows the photo it took, and sends nothing until Bheje', async () => {
    const onSubmit = jest.fn();
    render(<SelfieCaptureView onSubmit={onSubmit} />);
    await takePhoto();
    expect(screen.getByTestId('selfie-preview')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('selfie-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ uri: 'file:///selfie.jpg', mimeType: 'image/jpeg' });
  });

  it('goes back to the camera on Dobara', async () => {
    render(<SelfieCaptureView />);
    await takePhoto();
    fireEvent.press(screen.getByTestId('selfie-retake'));
    expect(screen.getByTestId('selfie-camera')).toBeTruthy();
    expect(screen.queryByTestId('selfie-preview')).toBeNull();
  });

  it('says so when the upload failed, keeping the photo', async () => {
    const view = render(<SelfieCaptureView />);
    await takePhoto();
    view.rerender(<SelfieCaptureView error="Network request failed" />);
    expect(screen.getByTestId('selfie-error')).toHaveTextContent('Network request failed');
    expect(screen.getByTestId('selfie-preview')).toBeTruthy();
  });

  it('confirms with Photo jama ho gyi hai.', () => {
    render(<SelfieDoneView />);
    expect(screen.getByText('Photo jama ho gyi hai.')).toBeTruthy();
  });
});

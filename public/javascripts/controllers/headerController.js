const showTutorialModal = () => {
  $('#videoModal').modal('show');
}

app.controller('HeaderController', ['$scope', 'HttpService', '$window', 'SweetAlertService', '$interval', '$timeout', function ($scope, HttpService, $window, SweetAlertService, $interval, $timeout) {
  $scope.profile = null;
  $scope.hasCameraPermission = false;
  $scope.isCameraOn = false;
  $scope.isFeedExpanded = false;
  $scope.videoStream = null;
  $scope.snapshotInterval = null;
  $scope.permissionError = '';

  $scope.loadProfile = function () {
    let localProfile = HttpService.getUserData();
    if (localProfile != null) {
      localProfile.profileImage = `${imageURL}${localProfile.profileImage}`;
      if (localProfile.role != "admin" && localProfile.workType == "remote") { $scope.requestCameraPermission(); }
    }
    $scope.profile = localProfile;
  };

  $scope.logout = function () {
    SweetAlertService.confirm("Logout", "Do you really want to logout?").then(function (result) {
      if (result.isConfirmed) {
        $scope.stopCamera();
        HttpService.clearStorage();
        redirectToLogin();
      }
    });
  };

  $scope.requestCameraPermission = function () {
    navigator.permissions.query({ name: 'camera' }).then((permissionStatus) => {
      if (permissionStatus.state === 'granted') {
        console.log('Camera permission is granted');
        $scope.requestCameraAccess();
      } else if (permissionStatus.state === 'denied') {
        console.log('Camera permission is denied');
        $('#cameraPermissionModal').modal('show');
      } else if (permissionStatus.state === 'prompt') {
        console.log('Camera permission has not been requested yet');
        $('#cameraPermissionModal').modal('show');
      }

      permissionStatus.onchange = () => {
        console.log('Camera permission changed to:', permissionStatus.state);
        if (permissionStatus.state === 'denied') {
          $('#cameraPermissionModal').modal('show');
          $scope.isCameraOn = false;
          $scope.stopCamera();
        }

        if (permissionStatus.state == 'granted') {
          $scope.requestCameraAccess();
        }
      };
    }).catch((error) => {
      console.error('Error checking camera permission:', error);
      $('#cameraPermissionModal').modal('show');
    });
  };

  $scope.requestCameraAccess = function () {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(function (stream) {
        $scope.videoStream = stream;
        $scope.hasCameraPermission = true;
        $scope.isCameraOn = true;
        $scope.permissionError = '';
        $scope.startSnapshotInterval();
        $scope.$apply();
        var video = document.getElementById('miniCameraFeed');
        if (video) video.srcObject = stream;
        $('#cameraPermissionModal').modal('hide');
      })
      .catch(function (err) {
        console.error('Camera access denied:', err);
        $scope.permissionError = 'Could not access the camera: ' + err.message;
        $scope.$apply();
      });
  };

  $scope.toggleCamera = function () {
    if ($scope.isCameraOn) {
      $scope.stopCamera();
    } else {
      $scope.requestCameraPermission();
    }
  };

  $scope.toggleCameraFeedSize = function () {
    $scope.isFeedExpanded = !$scope.isFeedExpanded;
    var feedContainer = document.querySelector('.camera-feed-container');
    if (feedContainer) {
      if ($scope.isFeedExpanded) {
        feedContainer.style.width = '320px';
        feedContainer.style.height = '240px';
      } else {
        // feedContainer.style.width = '160px';
        // feedContainer.style.height = '120px';
        feedContainer.style.width = '320px';
        feedContainer.style.height = '240px';
      }
    }
  };

  $scope.stopCamera = function () {
    if ($scope.videoStream) {
      $scope.videoStream.getTracks().forEach(track => track.stop());
      $scope.videoStream = null;
    }
    $scope.isCameraOn = false;
    if ($scope.snapshotInterval) {
      $interval.cancel($scope.snapshotInterval);
      $scope.snapshotInterval = null;
    }
    var video = document.getElementById('miniCameraFeed');
    if (video) video.srcObject = null;
  };

  $scope.startSnapshotInterval = function () {
    if ($scope.snapshotInterval) {
      $interval.cancel($scope.snapshotInterval);
    }
    $scope.captureSnapshot();
    $scope.snapshotInterval = $interval(function () {
      $scope.captureSnapshot();
    }, 60000 * 5);
  };

  $scope.captureSnapshot = function () {
    if (!$scope.isCameraOn || !$scope.videoStream) return;
    var video = document.getElementById('miniCameraFeed');
    if (!video) return;
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function (blob) {
      var formData = new FormData();
      formData.append('file', blob, 'snapshot_' + new Date().toISOString() + '.jpg');
      formData.append('userId', $scope.profile._id);
      HttpService.upload('/users/compare-faces', formData)
        .then(function (response) {
          console.log('Snapshot uploaded successfully:', response);
        })
        .catch(function (error) {
          console.error('Error uploading snapshot:', error);
        });
    }, 'image/jpeg', 0.8);
  };

  $scope.makeCameraFeedDraggable = function () {
    const container = document.querySelector('.camera-feed-container');
    if (!container) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    container.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      container.style.top = (container.offsetTop - pos2) + "px";
      container.style.left = (container.offsetLeft - pos1) + "px";
      container.style.right = 'auto';
      container.style.bottom = 'auto';
    }
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  };

  function redirectToLogin() {
    $window.location.href = "/";
  }

  $scope.loadProfile();
  $scope.$watch('isCameraOn', function (newVal) {
    if (newVal) {
      $timeout(function () {
        $scope.makeCameraFeedDraggable();
      }, 100);
    }
  });

  $scope.$on('$destroy', function () {
    $scope.stopCamera();
  });
}]);